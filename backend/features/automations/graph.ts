import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@database/generated/prisma/client";
import { advisory, type Tx } from "@database/client";
import { conflict, invalid, missing } from "@backend/lib/errors/domain";
import { requirePermission, type Actor } from "@backend/lib/permissions/policy";
import { audit, live, localInstant, type Mutation } from "@backend/features/crm/domain";
import { dateOnly, required, text, uuid } from "@backend/lib/validations/common";
import { digits, searchText } from "@shared/utils";
import { type NodeKind, type Workflow, type WorkflowRun, type WorkflowStep } from "@shared/model";
import { operations, simulateWorkflow, validateWorkflow } from "@shared/workflow";

export const operationCodes = {
  trigger: ["contact_created", "lead_created", "contact_status_changed", "deal_created", "deal_stage_changed", "task_due", "task_created", "schedule"],
  condition: ["status_equals", "amount_greater", "has_tag", "owner_equals", "and", "or"],
  action: ["send_sms", "create_task", "change_status", "assign_owner", "add_tag", "write_note", "notify", "demo_email", "demo_webhook"],
  delay: ["minutes", "hours", "days"],
} as const;
export const nodeKind = z.enum(["trigger", "condition", "action", "delay"]);
const node = z.object({ id: uuid, kind: nodeKind, operation: required(130), value: text(4_000), position: z.object({ x: z.number().finite(), y: z.number().finite() }) });
const edge = z.object({ id: uuid, source: uuid, target: uuid, branch: z.enum(["yes", "no", "next"]).optional() });
export const workflowInput = z.object({ id: uuid, name: text(), description: text(3_000), enabled: z.boolean(), rowVersion: z.number().int().positive().optional(), nodes: z.array(node).max(100), links: z.array(edge).max(250) });
export const scenarioSchema = z.object({ status: text(60), dealValue: z.string().transform(digits).pipe(z.string().regex(/^\d{1,20}$/, "ارزش معامله معتبر نیست.")), tags: text(600), owner: text(180), customer: text(180), company: text(180) });

export function toCode(kind: NodeKind, label: string) {
  const code = operationCodes[kind][operations[kind].indexOf(label)];
  if (!code) throw invalid("نوع عملیات نود معتبر نیست.");
  return code;
}
export const toLabel = (kind: NodeKind, code: string) => operations[kind][(operationCodes[kind] as readonly string[]).indexOf(code)] || operations[kind][0];
export function valueOf(config: Prisma.JsonValue) {
  return config && typeof config === "object" && !Array.isArray(config) && typeof config.value === "string" ? config.value : "";
}
const graphInclude = { nodes: { orderBy: { nodeId: "asc" as const } }, edges: { orderBy: { id: "asc" as const } } };
type Graph = Prisma.WorkflowVersionGetPayload<{ include: typeof graphInclude }>;
type Run = Prisma.WorkflowRunGetPayload<{ include: { steps: true } }>;

export function runDto(run: Run): WorkflowRun {
  return { id: run.id, date: run.startedAt.toISOString(), result: run.stateCode === "failed" ? "خطا" : run.stateCode === "succeeded" ? "موفق" : "در حال اجرا", steps: run.steps.map((step): WorkflowStep => ({
    nodeId: step.nodeId || step.id,
    title: step.message?.split("\n")[0] || "نتیجهٔ اجرا",
    result: step.outcomeCode === "failed" ? "خطا" : ["condition_false", "skipped"].includes(step.outcomeCode) ? "رد شد" : step.outcomeCode === "succeeded" ? "موفق" : "در حال اجرا",
    message: step.message?.split("\n").slice(1).join("\n") || "",
  })) };
}
export function graphDto(record: { id: string; name: string; description: string | null; activeVersionId: string | null; createdAt: Date; rowVersion: number }, version: Graph, runs: Run[]): Workflow {
  return { id: record.id, name: record.name, description: record.description || "", enabled: !!record.activeVersionId, rowVersion: record.rowVersion, created: record.createdAt.toISOString(), runs: runs.map(runDto),
    nodes: version.nodes.map((item) => { const kind = nodeKind.parse(item.kind); return { id: item.nodeId, kind, operation: toLabel(kind, item.operationCode), value: valueOf(item.config), position: { x: item.positionX, y: item.positionY } }; }),
    links: version.edges.map(({ id, sourceNodeId, targetNodeId, branchCode }) => ({ id, source: sourceNodeId, target: targetNodeId, branch: branchCode === "next" ? undefined : branchCode })),
  };
}

export async function findWorkflow(tx: Tx, actor: Actor, id: string) {
  const record = await tx.workflow.findFirst({ where: { ...live(actor), id }, include: { versions: { where: { isDraft: false }, orderBy: { revisionNo: "desc" }, take: 1, include: graphInclude } } });
  if (!record?.versions.length) throw missing();
  const runs = await tx.workflowRun.findMany({ where: { workspaceId: actor.workspaceId, version: { workflowId: id } }, orderBy: { startedAt: "desc" }, take: 20, include: { steps: { orderBy: { sequenceNo: "asc" } } } });
  return graphDto(record, record.versions[0], runs);
}
export function nextSchedule(value: string, timezone: string, after = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(after);
  const day = dateOnly(date);
  const time = new Date("1970-01-01T" + digits(value) + ":00Z");
  const current = localInstant(day, time, timezone);
  return current > after ? current : localInstant(new Date(day.valueOf() + 86_400_000), time, timezone);
}
async function persistDraft(ctx: Mutation, input: z.output<typeof workflowInput>, isDraft: boolean) {
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":workflow:" + input.id);
  const existing = await tx.workflow.findFirst({ where: { ...live(actor), id: input.id } });
  if (existing && input.rowVersion && existing.rowVersion !== input.rowVersion) throw conflict("گردش‌کار هم‌زمان ویرایش شده است.");
  const name = input.name || "پیش‌نویس گردش‌کار";
  const now = new Date();
  const record = existing ?? await tx.workflow.create({ data: { id: input.id, workspaceId, name, searchKey: searchText(name) } });
  const nodeIds = new Set(input.nodes.map(({ id }) => id));
  const branchKeys = new Set<string>();
  if (nodeIds.size !== input.nodes.length || input.nodes.filter((node) => node.kind === "trigger").length > 1 || input.links.some((edge) => {
    const key = edge.source + ":" + (edge.branch && edge.branch !== "next" ? edge.branch : edge.target);
    const duplicate = branchKeys.has(key);
    branchKeys.add(key);
    return duplicate || edge.source === edge.target || !nodeIds.has(edge.source) || !nodeIds.has(edge.target);
  })) throw invalid("اتصال‌ها یا شناسه‌های گردش‌کار معتبر نیستند.");
  const revision = await tx.workflowVersion.aggregate({ where: { workspaceId, workflowId: record.id }, _max: { revisionNo: true } });
  const trigger = input.nodes.find((node) => node.kind === "trigger");
  const triggerCode = trigger ? toCode("trigger", trigger.operation) : null;
  const version = await tx.workflowVersion.create({ data: { workspaceId, workflowId: record.id, revisionNo: (revision._max.revisionNo ?? 0) + 1, createdByMembershipId: actor.membershipId, triggerCode, isDraft } });
  if (input.nodes.length) await tx.workflowNode.createMany({ data: input.nodes.map((node) => ({ workspaceId, versionId: version.id, nodeId: node.id, kind: node.kind, operationCode: toCode(node.kind, node.operation), config: { value: node.value }, positionX: node.position.x, positionY: node.position.y })) });
  if (input.links.length) await tx.workflowEdge.createMany({ data: input.links.map((edge) => ({ workspaceId, versionId: version.id, sourceNodeId: edge.source, targetNodeId: edge.target, branchCode: edge.branch ?? "next" })) });
  if (!isDraft) {
    const zone = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
    await tx.workflow.update({ where: { id: record.id, workspaceId }, data: { name, description: input.description, searchKey: searchText(name + " " + input.description), activeVersionId: input.enabled ? version.id : null, nextRunAt: input.enabled && triggerCode === "schedule" && trigger ? nextSchedule(trigger.value, zone.timezone, now) : null, rowVersion: { increment: 1 } } });
  }
  return version;
}
export async function saveWorkflow(ctx: Mutation, raw: unknown) {
  requirePermission(ctx.actor, "automation.manage");
  const input = workflowInput.parse(raw);
  if (!input.name) throw invalid("نام گردش‌کار الزامی است.");
  const descriptor = { ...input, created: "", runs: [] };
  const errors = validateWorkflow(descriptor);
  if (input.enabled && errors.length) throw invalid(errors[0]);
  const version = await persistDraft(ctx, input, false);
  await audit(ctx, "saved", "workflows", input.id);
  const row = await ctx.tx.workflow.findFirstOrThrow({ where: { id: input.id, workspaceId: ctx.actor.workspaceId }, select: { rowVersion: true } });
  return { id: input.id, versionId: version.id, rowVersion: row.rowVersion };
}

export async function toggleWorkflow(ctx: Mutation, id: string, enabled: boolean) {
  requirePermission(ctx.actor, "automation.manage");
  const workspaceId = ctx.actor.workspaceId;
  await advisory(ctx.tx, workspaceId + ":workflow:" + id);
  const workflow = await findWorkflow(ctx.tx, ctx.actor, id);
  const version = await ctx.tx.workflowVersion.findFirstOrThrow({ where: { workspaceId, workflowId: id, isDraft: false }, orderBy: { revisionNo: "desc" } });
  const errors = validateWorkflow(workflow);
  if (enabled && errors.length) throw invalid(errors[0]);
  const trigger = workflow.nodes.find((node) => node.kind === "trigger");
  const zone = await ctx.tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  await ctx.tx.workflow.update({ where: { id, workspaceId }, data: { activeVersionId: enabled ? version.id : null, nextRunAt: enabled && version.triggerCode === "schedule" && trigger ? nextSchedule(trigger.value, zone.timezone) : null, rowVersion: { increment: 1 } } });
  await audit(ctx, enabled ? "enabled" : "disabled", "workflows", id);
  return id;
}

export async function testWorkflow(ctx: Mutation, raw: unknown, rawScenario: unknown) {
  requirePermission(ctx.actor, "automation.manage");
  const input = workflowInput.parse(raw);
  const data = scenarioSchema.parse(rawScenario);
  const result = simulateWorkflow({ ...input, created: "", runs: [] }, data);
  const version = await persistDraft(ctx, input, true);
  const workspaceId = ctx.actor.workspaceId;
  const run = await ctx.tx.workflowRun.create({ data: { id: result.id, workspaceId, versionId: version.id, startedByMembershipId: ctx.actor.membershipId, modeCode: "test", stateCode: result.result === "موفق" ? "succeeded" : "failed", runKey: randomUUID(), scenario: { status: data.status, dealValue: data.dealValue }, endedAt: new Date() } });
  const nodeIds = new Set(input.nodes.map(({ id }) => id));
  await ctx.tx.workflowRunStep.createMany({ data: result.steps.map((step, index) => ({ workspaceId, runId: run.id, versionId: version.id, nodeId: nodeIds.has(step.nodeId) ? step.nodeId : null, sequenceNo: index, effectKey: run.id + ":" + index, outcomeCode: step.result === "موفق" ? "succeeded" : step.result === "خطا" ? "failed" : "skipped", message: step.title + "\n" + step.message, finishedAt: new Date() })) });
  await audit(ctx, "tested", "workflows", input.id);
  return result;
}
export async function recentWorkflows(tx: Tx, actor: Actor, query: string, active?: boolean, skip = 0, take = 8) {
  requirePermission(actor, "automation.manage");
  const where: Prisma.WorkflowWhereInput = { ...live(actor), versions: { some: { isDraft: false } }, ...(query ? { searchKey: { contains: searchText(query) } } : {}), ...(active === undefined ? {} : { activeVersionId: active ? { not: null } : null }) };
  const [records, total] = await Promise.all([
    tx.workflow.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "asc" }], include: { versions: { where: { isDraft: false }, orderBy: { revisionNo: "desc" }, take: 1, include: graphInclude } } }),
    tx.workflow.count({ where }),
  ]);
  const ids = records.map((item) => item.id);
  const rows = await tx.$queryRaw<{ workflow_id: string; count: bigint; last: Date }[]>`
    SELECT v.workflow_id, count(*) count, max(r.started_at) last FROM workflow_run r
    JOIN workflow_version v ON v.workspace_id = r.workspace_id AND v.id = r.version_id
    WHERE r.workspace_id = ${actor.workspaceId}::uuid AND v.workflow_id = ANY(${ids}::uuid[]) GROUP BY v.workflow_id`;
  return { rows: records.map((item) => {
    const tally = rows.find((row) => row.workflow_id === item.id);
    return { ...graphDto(item, item.versions[0], []), runCount: Number(tally?.count ?? 0), lastRunAt: tally?.last?.toISOString() };
  }), total };
}
