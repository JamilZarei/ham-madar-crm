import { createHash } from "node:crypto";
import { z } from "zod";
import { advisory, type Tx } from "@database/client";
import { conflict, invalid, missing } from "@backend/lib/errors/domain";
import { localPhone, optional, optionalId, phone, required, uuid } from "@backend/lib/validations/common";
import { requirePermission, type Actor } from "@backend/lib/permissions/policy";
import type { Prisma } from "@database/generated/prisma/client";
import { type Sms } from "@shared/model";
import { smsType } from "@shared/codes";
import { audit, type Mutation } from "@backend/features/crm/domain";
import type { ListQuery } from "@backend/features/crm/schemas";
import { mockSmsProvider } from "./provider";

const statusLabel = (code: string): Sms["status"] => code === "delivered" ? "موفق" : code === "failed" ? "ناموفق" : "در انتظار";
export const sendInput = z.object({
  key: uuid, selected: z.array(uuid).max(100), mobile: z.union([phone, z.literal("")]).transform((value) => value || null),
  text: required(670), type: smsType.schema, templateId: optionalId,
});
type Send = z.output<typeof sendInput>;
const variables = ["{{customer_name}}", "{{company_name}}"];
export function personalize(text: string, name?: string | null, company?: string | null) {
  return text.replaceAll(variables[0], name || "مشتری گرامی").replaceAll(variables[1], company || "شرکت شما");
}
function units(text: string) {
  const gsm = /^[\x20-\x7e\n\r]*$/.test(text);
  return text.length <= (gsm ? 160 : 70) ? 1 : Math.ceil(text.length / (gsm ? 153 : 67));
}
export async function smsCredit(tx: Tx, workspaceId: string) {
  const [settings, used] = await Promise.all([tx.workspaceSettings.findUnique({ where: { workspaceId } }), tx.smsMessage.aggregate({ where: { workspaceId, send: { modeCode: "simulation" } }, _sum: { unitCount: true } })]);
  return Math.max(0, (settings?.smsDemoQuota ?? 250) - (used._sum.unitCount ?? 0));
}

export async function sendSimulation(ctx: Mutation, input: Send, automationStep?: string) {
  if (!automationStep) requirePermission(ctx.actor, "sms.send");
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":sms-quota");
  const key = input.key;
  const requestHash = createHash("sha256").update(JSON.stringify({ ...input, selected: [...new Set(input.selected)].sort(), actorId: actor.membershipId, automationStep })).digest("hex");
  const existing = await tx.smsSend.findFirst({ where: { workspaceId, idempotencyKey: key }, select: { id: true, requestHash: true, _count: { select: { messages: true } } } });
  if (existing) {
    if (existing.requestHash !== requestHash) throw conflict("کلید ارسال قبلاً با اطلاعات دیگری استفاده شده است.");
    return { id: existing.id, count: existing._count.messages };
  }
  if (input.templateId && !await tx.smsTemplate.findFirst({ where: { id: input.templateId, workspaceId, deletedAt: null } })) throw missing();
  const selected = [...new Set(input.selected)];
  const owners = await tx.contact.findMany({ where: { workspaceId, deletedAt: null, id: { in: selected } }, select: { id: true, mobileE164: true, fullName: true, company: { select: { name: true } } } });
  if (owners.length !== selected.length) throw missing();
  if (input.mobile && !owners.some((item) => item.mobileE164 === input.mobile)) {
    const contact = await tx.contact.findFirst({ where: { workspaceId, deletedAt: null, mobileE164: input.mobile }, select: { id: true, mobileE164: true, fullName: true, company: { select: { name: true } } } });
    owners.push(contact ?? { id: "", mobileE164: input.mobile, fullName: "", company: null });
  }
  if (!owners.length) throw invalid("حداقل یک گیرنده انتخاب کنید.");
  const messages = owners.map((item) => {
    const body = personalize(input.text, item.fullName, item.company?.name);
    return { item, body, unitCount: units(body) };
  });
  if (messages.reduce((sum, message) => sum + message.unitCount, 0) > await smsCredit(tx, workspaceId)) throw invalid("اعتبار آزمایشی پیامک کافی نیست.");
  const send = await tx.smsSend.create({ data: { workspaceId, templateId: input.templateId, requestedByMembershipId: actor.membershipId, workflowRunStepId: automationStep, sourceCode: automationStep ? "automation" : "manual", messageTypeCode: input.type, idempotencyKey: key, requestHash } });
  for (const { item, body, unitCount } of messages) {
    const statusCode = await mockSmsProvider.send(item.mobileE164, body, key + "-" + item.mobileE164);
    const record = await tx.smsMessage.create({ data: { workspaceId, sendId: send.id, contactId: item.id || null, recipientMobileE164: item.mobileE164, recipientNameSnapshot: item.fullName || null, renderedBody: body, unitCount, statusCode, attemptCount: 1, sentAt: new Date() } });
    await tx.smsStatusEvent.create({ data: { workspaceId, messageId: record.id, statusCode, attemptNo: 1 } });
  }
  await audit(ctx, "simulated_send", "sms", send.id);
  return { id: send.id, count: messages.length };
}

export async function retryMessage(ctx: Mutation, id: string) {
  const { tx, actor } = ctx;
  requirePermission(actor, "sms.send");
  await advisory(tx, actor.workspaceId + ":sms-message:" + id);
  const record = await tx.smsMessage.findFirst({ where: { id, workspaceId: actor.workspaceId, send: { modeCode: "simulation" } } });
  if (!record) throw missing();
  if (record.statusCode !== "failed" || record.attemptCount >= 4) throw conflict("تلاش مجدد برای این پیام در دسترس نیست.");
  const statusCode = await mockSmsProvider.send(record.recipientMobileE164, record.renderedBody, record.id);
  const attemptNo = record.attemptCount + 1;
  await tx.smsMessage.update({ where: { id, workspaceId: actor.workspaceId }, data: { statusCode, attemptCount: attemptNo, sentAt: new Date() } });
  await tx.smsStatusEvent.create({ data: { workspaceId: actor.workspaceId, messageId: id, attemptNo, statusCode } });
  await audit(ctx, "retry", "sms", id);
  return { id, status: statusLabel(statusCode) };
}

export async function recentMessages(tx: Tx, actor: Actor, query: ListQuery, window: { skip: number; take: number }) {
  requirePermission(actor, "sms.send");
  const status = query.status === "موفق" ? "delivered" : query.status === "ناموفق" ? "failed" : query.status === "در انتظار" ? { in: ["queued", "submitted", "acceptance_unknown"] } : undefined;
  const sourceCode = query.source === "دستی" ? "manual" : query.source === "اتوماسیون" ? "automation" : undefined;
  const where: Prisma.SmsMessageWhereInput = { workspaceId: actor.workspaceId, statusCode: status, send: { sourceCode },
    ...(query.search ? { OR: [{ recipientMobileE164: { contains: query.search.replace(/^0/, "+98") } }, { recipientNameSnapshot: { contains: query.search, mode: "insensitive" } }, { renderedBody: { contains: query.search, mode: "insensitive" } }] } : {}) };
  const sorts: Record<string, Prisma.SmsMessageOrderByWithRelationInput> = { mobile: { recipientMobileE164: query.direction }, name: { recipientNameSnapshot: query.direction }, text: { renderedBody: query.direction }, status: { statusCode: query.direction }, source: { send: { sourceCode: query.direction } }, type: { send: { messageTypeCode: query.direction } } };
  const orderBy = [Object.hasOwn(sorts, query.sort) ? sorts[query.sort] : { createdAt: query.direction }, { id: "asc" as const }];
  const [records, total] = await Promise.all([tx.smsMessage.findMany({ where, ...window, orderBy, include: { send: { select: { sourceCode: true, messageTypeCode: true } } } }), tx.smsMessage.count({ where })]);
  return { total, rows: records.map((item): Sms => ({ id: item.id, contactId: item.contactId || "", mobile: localPhone(item.recipientMobileE164), name: item.recipientNameSnapshot || "", text: item.renderedBody, date: item.createdAt.toISOString(), status: statusLabel(item.statusCode), type: smsType.label(item.send.messageTypeCode), source: item.send.sourceCode === "automation" ? "اتوماسیون" : "دستی" })) };
}

export const statusEventSchema = z.object({ id: required(120), messageRef: required(180), status: z.enum(["submitted", "delivered", "failed"]), account: optional(120) });
