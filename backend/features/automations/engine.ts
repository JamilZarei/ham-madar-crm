import { z } from "zod";
import type { Prisma } from "@database/generated/prisma/client";
import type { Tx } from "@database/client";
import { advisory } from "@database/client";
import { DomainError, invalid } from "@backend/lib/errors/domain";
import { has, type Actor } from "@backend/lib/permissions/policy";
import { contactState, smsType } from "@shared/codes";
import { localPhone, uuid } from "@backend/lib/validations/common";
import { digits, searchText } from "@shared/utils";
import { getPredicates } from "@shared/workflow";
import { addNote, event, saveRecord, type Mutation } from "@backend/features/crm/domain";
import { sendSimulation } from "@backend/features/sms/service";
import { nextSchedule, nodeKind, toCode, toLabel, valueOf } from "./graph";
import { workspaceDay } from "@backend/features/reports/report";

const sourceSchema = z.object({
  entityId: uuid, contactId: uuid.nullish(), actorId: uuid.nullish(), scheduledAt: z.iso.datetime().optional(),
  reminderId: uuid.optional(), versionId: uuid.optional(), scheduledFor: z.iso.datetime().optional(), path: z.array(uuid).max(8).optional(),
});
type Source = z.output<typeof sourceSchema>;
export const sourceEvents = ["contact_created", "lead_created", "contact_status_changed", "deal_created", "deal_stage_changed", "task_due", "task_created", "schedule"];

async function runner(tx: Tx, workspaceId: string, membershipId: string | null): Promise<Actor | null> {
  if (!membershipId) return null;
  const member = await tx.membership.findFirst({ where: { workspaceId, id: membershipId, statusCode: "active", user: { disabledAt: null }, role: { deletedAt: null } }, include: { user: { select: { fullName: true } }, role: { include: { grants: true } } } });
  if (!member) return null;
  const actor: Actor = { workspaceId, membershipId: member.id, name: member.user.fullName, userId: member.userId, role: member.role.code, grants: new Set(member.role.grants.map((grant) => grant.permissionCode)) };
  return has(actor, "automation.manage") ? actor : null;
}

export async function scheduleDue(tx: Tx, workspaceId: string, now: Date) {
  const items = await tx.workflow.findMany({ where: { workspaceId, deletedAt: null, activeVersionId: { not: null }, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: 20, select: { id: true } });
  if (!items.length) return;
  const { timezone } = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
  for (const { id } of items) {
    await advisory(tx, workspaceId + ":workflow:" + id);
    const current = await tx.workflow.findFirst({ where: { id, workspaceId, deletedAt: null, nextRunAt: { lte: now }, activeVersion: { triggerCode: "schedule" } }, include: { activeVersion: { include: { nodes: { where: { kind: "trigger" }, take: 1 } } } } });
    if (!current?.activeVersion || !current.nextRunAt) continue;
    const scheduledFor = current.nextRunAt.toISOString();
    await event(tx, workspaceId, "schedule", "schedule:" + id + ":" + scheduledFor, { entityId: id, versionId: current.activeVersion.id, scheduledFor });
    await tx.workflow.update({ where: { id, workspaceId }, data: { nextRunAt: nextSchedule(valueOf(current.activeVersion.nodes[0]?.config ?? null), timezone, now) } });
  }
}

async function notifyDue(tx: Tx, workspaceId: string, source: Source) {
  const reminder = await tx.taskReminder.findFirst({ where: { workspaceId, id: source.reminderId, taskId: source.entityId, statusCode: "pending", task: { deletedAt: null, statusCode: { not: "done" } } }, include: { task: { include: { assignee: { select: { taskAlertsEnabled: true, notificationsEnabled: true, statusCode: true } } } } } });
  if (!reminder || reminder.scheduledAt.toISOString() !== source.scheduledAt) return false;
  const task = reminder.task;
  if (task.assignee.statusCode === "active" && task.assignee.notificationsEnabled && task.assignee.taskAlertsEnabled) {
    await tx.notification.upsert({ where: { workspaceId_taskReminderId: { workspaceId, taskReminderId: reminder.id } }, create: { workspaceId, recipientMembershipId: task.assigneeMembershipId, taskReminderId: reminder.id, name: task.name, body: "زمان یادآوری یا سررسید فرا رسید.", kindCode: "task_due" }, update: { recipientMembershipId: task.assigneeMembershipId, name: task.name, readAt: null, createdAt: new Date() } });
  }
  await tx.taskReminder.update({ where: { id: reminder.id, workspaceId }, data: { statusCode: "sent" } });
  return true;
}

export async function handleTrigger(tx: Tx, workspaceId: string, type: string, triggerId: string, raw: Prisma.JsonValue, eventTime: Date) {
  if (!sourceEvents.includes(type)) throw invalid("نوع رویداد معتبر نیست.");
  const input = sourceSchema.parse(raw);
  if (type === "task_due" && !await notifyDue(tx, workspaceId, input)) return;
  const path = input.path || [];
  if (path.length >= 8) return;
  const triggeredAt = type === "task_due" && input.scheduledAt ? new Date(input.scheduledAt) : eventTime;
  const candidates = await tx.workflow.findMany({ where: { workspaceId, deletedAt: null, ...(type === "schedule" ? { id: input.entityId, activeVersionId: input.versionId } : { id: { notIn: path }, updatedAt: { lte: triggeredAt } }), activeVersion: { triggerCode: type } }, include: { activeVersion: { include: { nodes: true } } } });
  for (const item of candidates) {
    const version = item.activeVersion;
    if (!version) continue;
    const actor = await runner(tx, workspaceId, version.createdByMembershipId);
    const runKey = "event:" + triggerId + ":" + item.id;
    const exists = await tx.workflowRun.findFirst({ where: { workspaceId, runKey }, select: { id: true } });
    if (exists) continue;
    const run = await tx.workflowRun.create({ data: { workspaceId, versionId: version.id, startedByMembershipId: actor?.membershipId, modeCode: "live", stateCode: actor ? "running" : "failed", runKey, scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined, scenario: { ...input, path: [...path, item.id] }, endedAt: actor ? undefined : new Date() } });
    if (!actor) {
      await tx.workflowRunStep.create({ data: { workspaceId, runId: run.id, versionId: version.id, sequenceNo: 0, effectKey: run.id + ":permission", outcomeCode: "failed", message: "دسترسی اجرا\nمجری ثبت‌شده اجازهٔ اجرای گردش‌کار را ندارد.", finishedAt: new Date() } });
      continue;
    }
    const ordered = [...version.nodes].sort((a, b) => (a.kind === "trigger" ? -1 : 0) - (b.kind === "trigger" ? -1 : 0) || a.nodeId.localeCompare(b.nodeId));
    await tx.workflowRunStep.createMany({ data: ordered.map((node, index) => ({ workspaceId, runId: run.id, versionId: version.id, nodeId: node.nodeId, sequenceNo: index, effectKey: run.id + ":" + node.nodeId, outcomeCode: "pending", message: toLabel(nodeKind.parse(node.kind), node.operationCode) })) });
    await event(tx, workspaceId, "workflow_step", "run:" + run.id + ":start", { entityId: run.id });
  }
}

async function contextFor(tx: Tx, workspaceId: string, source: Source) {
  const [deal, lead, task] = await Promise.all([
    tx.deal.findFirst({ where: { workspaceId, id: source.entityId, deletedAt: null } }),
    tx.lead.findFirst({ where: { workspaceId, id: source.entityId, deletedAt: null } }),
    tx.task.findFirst({ where: { workspaceId, id: source.entityId, deletedAt: null } }),
  ]);
  const contactId = source.contactId || deal?.contactId || task?.contactId || source.entityId;
  const contact = await tx.contact.findFirst({ where: { workspaceId, id: contactId, deletedAt: null }, include: { owner: { include: { user: { select: { fullName: true } } } }, tags: { include: { tag: true } } } });
  return { contact, deal, lead };
}
type Context = Awaited<ReturnType<typeof contextFor>>;

function evaluate(operation: string, value: string, ctx: Context): boolean {
  switch (operation) {
    case "and":
    case "or": {
      const parts = getPredicates(value).map((rule) => evaluate(toCode("condition", rule.operation), rule.value, ctx));
      return operation === "and" ? parts.every(Boolean) : parts.some(Boolean);
    }
    case "status_equals": return !!ctx.contact && contactState.label(ctx.contact.statusCode) === value;
    case "amount_greater": return !!ctx.deal && /^\d{1,20}$/.test(digits(value)) && BigInt(ctx.deal.amountToman.toFixed(0)) > BigInt(digits(value));
    case "has_tag": return !!ctx.contact?.tags.some(({ tag }) => tag.nameKey === searchText(value));
    case "owner_equals": return ctx.contact?.owner?.user.fullName === value;
    default: throw invalid("عملیات شرط معتبر نیست.");
  }
}

async function action(ctx: Mutation, operation: string, value: string, source: Source, stepId: string) {
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  const data = await contextFor(tx, workspaceId, source);
  const contact = data.contact;
  const assignee = contact?.ownerMembershipId || data.deal?.ownerMembershipId || data.lead?.ownerMembershipId || actor.membershipId;
  switch (operation) {
    case "demo_email": return "ایمیل آزمایشی ثبت شد.";
    case "demo_webhook": return "وب‌هوک آزمایشی ثبت شد.";
    case "notify":
      await tx.notification.create({ data: { workspaceId, recipientMembershipId: assignee, name: "اعلان گردش‌کار", body: value, kindCode: "workflow" } });
      return "اعلان ثبت شد.";
    case "create_task": {
      const { timezone } = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
      await saveRecord(ctx, "tasks", { id: stepId, name: value, contactId: contact?.id, owner: assignee, priority: "متوسط", status: "باز", due: workspaceDay(timezone), reminder: "" });
      return "وظیفه ایجاد شد.";
    }
  }
  if (!contact) throw invalid("در این اجرا مشتری مرتبطی وجود ندارد.");
  if (operation === "send_sms") {
    await sendSimulation(ctx, { key: stepId, selected: [contact.id], mobile: null, text: value, type: smsType.code("اطلاع‌رسانی"), templateId: null }, stepId);
    return "پیامک آزمایشی برای مشتری ثبت شد.";
  }
  if (operation === "write_note") {
    await addNote(ctx, "contacts", contact.id, value);
    return "یادداشت ثبت شد.";
  }
  if (!["change_status", "assign_owner", "add_tag"].includes(operation)) throw invalid("عملیات گردش‌کار معتبر نیست.");
  const owner = operation === "assign_owner" ? await tx.membership.findFirst({ where: { workspaceId, statusCode: "active", user: { fullName: value } }, select: { id: true } }) : null;
  if (operation === "assign_owner" && !owner) throw invalid("کارشناس انتخاب‌شده در دسترس نیست.");
  const tags = contact.tags.map(({ tag }) => tag.name);
  if (operation === "add_tag") tags.push(value);
  await saveRecord(ctx, "contacts", { id: contact.id, name: contact.fullName, mobile: localPhone(contact.mobileE164), companyId: contact.companyId, owner: owner?.id ?? contact.ownerMembershipId, email: contact.email, role: contact.jobTitle, status: operation === "change_status" ? value : contactState.label(contact.statusCode), tags, description: contact.description });
  return "اطلاعات مشتری به‌روزرسانی شد.";
}

export async function advanceRun(tx: Tx, workspaceId: string, runId: string) {
  await advisory(tx, "workflow-run:" + runId);
  const run = await tx.workflowRun.findFirst({ where: { workspaceId, id: runId, stateCode: "running" }, include: { version: { include: { nodes: true, edges: true, workflow: { select: { deletedAt: true } } } }, steps: { orderBy: { sequenceNo: "asc" } } } });
  if (!run) return;
  const source = sourceSchema.parse(run.scenario);
  const actor = await runner(tx, workspaceId, run.startedByMembershipId);
  if (!actor || run.version.workflow.deletedAt) throw new DomainError("WORKFLOW_ACCESS", "گردش‌کار یا مجری آن از دسترس خارج شده است.", 403);
  const terminal = new Set(["succeeded", "condition_false", "skipped"]);
  const byNode = new Map(run.steps.map((step) => [step.nodeId, step]));
  const remaining = run.steps.filter((step) => !terminal.has(step.outcomeCode));
  if (!remaining.length) {
    await tx.workflowRun.update({ where: { id: runId, workspaceId }, data: { stateCode: "succeeded", endedAt: new Date() } });
    return;
  }
  const now = new Date();
  const step = remaining.find((step) => {
    if (step.outcomeCode === "waiting") return !!step.nextAttemptAt && step.nextAttemptAt <= now;
    if (step.outcomeCode !== "pending") return false;
    return run.version.edges.filter((edge) => edge.targetNodeId === step.nodeId).every((edge) => terminal.has(byNode.get(edge.sourceNodeId)?.outcomeCode || ""));
  });
  if (!step) return;
  const node = run.version.nodes.find((node) => node.nodeId === step.nodeId);
  if (!node) throw invalid("نود اجرا پیدا نشد.");
  const edges = run.version.edges.filter((edge) => edge.targetNodeId === node.nodeId);
  const selected = node.kind === "trigger" || edges.some((edge) => {
    const status = byNode.get(edge.sourceNodeId)?.outcomeCode;
    return status === "succeeded" && edge.branchCode !== "no" || status === "condition_false" && edge.branchCode === "no";
  });
  const title = toLabel(nodeKind.parse(node.kind), node.operationCode);
  let outcomeCode = "succeeded";
  let message = "آغازگر اجرا شد.";
  const value = valueOf(node.config);
  if (!selected) { outcomeCode = "skipped"; message = "این شاخه انتخاب نشد."; }
  else if (node.kind === "delay" && step.outcomeCode !== "waiting") {
    const unit = node.operationCode === "minutes" ? 60_000 : node.operationCode === "hours" ? 3_600_000 : 86_400_000;
    const duration = Number(digits(value)) * unit;
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 365 * 86_400_000) throw invalid("مدت تأخیر معتبر نیست.");
    const resumeAt = new Date(now.valueOf() + duration);
    await tx.workflowRunStep.update({ where: { id: step.id, workspaceId }, data: { outcomeCode: "waiting", nextAttemptAt: resumeAt, message: title + "\nدر انتظار زمان ادامه" } });
    await event(tx, workspaceId, "workflow_step", "run:" + runId + ":resume:" + step.id, { entityId: runId }, resumeAt);
    await event(tx, workspaceId, "workflow_step", "run:" + runId + ":parallel:" + step.id, { entityId: runId });
    return;
  } else if (node.kind === "delay") message = "زمان تأخیر به پایان رسید.";
  else if (node.kind === "condition") {
    const match = evaluate(node.operationCode, value, await contextFor(tx, workspaceId, source));
    outcomeCode = match ? "succeeded" : "condition_false";
    message = match ? "شرط برقرار بود." : "شرط برقرار نبود.";
  } else if (node.kind === "action") {
    message = await action({ tx, actor, requestId: step.id, cause: source.path }, node.operationCode, value, source, step.id);
  }
  await tx.workflowRunStep.update({ where: { id: step.id, workspaceId }, data: { outcomeCode, message: title + "\n" + message, nextAttemptAt: null, finishedAt: new Date(), attemptCount: { increment: 1 } } });
  await event(tx, workspaceId, "workflow_step", "run:" + runId + ":after:" + step.id, { entityId: runId });
}
