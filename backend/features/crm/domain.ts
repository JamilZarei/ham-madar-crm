import { advisory, type Tx } from "@database/client";
import type { Prisma } from "@database/generated/prisma/client";
import { allRecords, ownerFilter, taskFilter, requirePermission, type Actor } from "@backend/lib/permissions/policy";
import { conflict, forbidden, invalid, missing } from "@backend/lib/errors/domain";
import { recordSchemas, type Collection } from "./schemas";
import { reminders } from "@shared/codes";
import { isoDate, isoTime, localPhone } from "@backend/lib/validations/common";
import { searchText } from "@shared/utils";

export type Mutation = { actor: Actor; requestId: string; tx: Tx; cause?: string[] };
export const live = (actor: Actor) => ({ workspaceId: actor.workspaceId, deletedAt: null });
export function companyScope(actor: Actor): Prisma.CompanyWhereInput {
  const base = live(actor);
  if (allRecords(actor)) return base;
  const owned = { ...base, ...ownerFilter(actor) };
  return { ...base, OR: [{ contacts: { some: owned } }, { leads: { some: owned } }, { deals: { some: owned } }] };
}
export function activityScope(actor: Actor): Prisma.ActivityWhereInput {
  const base = live(actor);
  if (allRecords(actor)) return base;
  const owner = ownerFilter(actor);
  return { ...base, OR: [{ actorMembershipId: actor.membershipId }, { contact: { ...base, ...owner } }, { lead: { ...base, ...owner } }, { deal: { ...base, ...owner } }, { task: { ...base, ...taskFilter(actor) } }] };
}
const contactScope = (actor: Actor) => ({ ...live(actor), ...ownerFilter(actor) });
export async function audit({ tx, actor, requestId }: Mutation, action: string, targetType: string, targetId: string) {
  await tx.auditLog.create({ data: { workspaceId: actor.workspaceId, actorMembershipId: actor.membershipId, action, targetType, targetId, requestId, resultCode: "success" } });
}
export async function event(tx: Tx, workspaceId: string, kind: string, eventKey: string, payload: Prisma.InputJsonObject, availableAt?: Date) {
  await tx.outboxEvent.upsert({ where: { workspaceId_eventKey: { workspaceId, eventKey } }, create: { workspaceId, kind, eventKey, payload, availableAt }, update: {} });
}
async function ownerFor({ tx, actor }: Mutation, id: string | null, previous?: string | null) {
  if (!allRecords(actor)) {
    if (id && id !== actor.membershipId) throw forbidden();
    return actor.membershipId;
  }
  const owner = id ?? (previous === undefined ? actor.membershipId : null);
  if (owner && owner !== previous && !await tx.membership.findFirst({ where: { id: owner, workspaceId: actor.workspaceId, statusCode: "active" }, select: { id: true } })) throw invalid("کارشناس انتخاب‌شده فعال نیست.");
  return owner;
}
async function refs({ tx, actor }: Mutation, companyId?: string | null, contactId?: string | null) {
  if (companyId && !await tx.company.findFirst({ where: { ...companyScope(actor), id: companyId }, select: { id: true } })) throw missing();
  if (contactId && !await tx.contact.findFirst({ where: { ...contactScope(actor), id: contactId }, select: { id: true } })) throw missing();
}
async function timeline({ tx, actor }: Mutation, kindCode: string, name: string, data: Partial<Pick<Prisma.ActivityUncheckedCreateInput, "description" | "contactId" | "companyId" | "dealId" | "leadId" | "taskId" | "noteId">>) {
  await tx.activity.create({ data: { ...data, name, kindCode, searchKey: searchText(name), actorMembershipId: actor.membershipId, workspaceId: actor.workspaceId, isSystem: true } });
}
function listKey(name: string, ...other: (string | null | undefined)[]) {
  return searchText([name, ...other.filter(Boolean)].join(" "));
}

export function localInstant(date: Date, time: Date | null, timezone: string) {
  const wall = new Date(isoDate(date) + "T" + (isoTime(time) || "17:00") + ":00Z").valueOf();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
  let candidate = wall;
  for (let i = 0; i < 3; i++) {
    const map = Object.fromEntries(parts.formatToParts(new Date(candidate)).map((part) => [part.type, Number(part.value)]));
    candidate += wall - Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
  }
  return new Date(candidate);
}

export async function saveRecord(ctx: Mutation, collection: Collection, raw: unknown) {
  const { tx, actor } = ctx;
  requirePermission(actor, "crm.write");
  const workspaceId = actor.workspaceId;
  const base = live(actor);
  const ownerScope = ownerFilter(actor);

  if (collection === "contacts") {
    const item = recordSchemas.contacts.parse(raw);
    await advisory(tx, workspaceId + ":contact:" + item.id);
    const existing = await tx.contact.findFirst({ where: { ...base, ...ownerScope, id: item.id } });
    await refs(ctx, item.companyId !== existing?.companyId ? item.companyId : null);
    const ownerMembershipId = await ownerFor(ctx, item.owner, existing?.ownerMembershipId);
    const data = { fullName: item.name, mobileE164: item.mobile, email: item.email, companyId: item.companyId, jobTitle: item.role, sourceCode: item.source, statusCode: item.status, description: item.description, ownerMembershipId, searchKey: listKey(item.name, localPhone(item.mobile), item.mobile, item.email, ...item.tags) };
    const record = existing ? await tx.contact.update({ where: { id: existing.id, workspaceId }, data }) : await tx.contact.create({ data: { ...data, id: item.id, workspaceId } });
    const tagIds: string[] = [];
    for (const [nameKey, name] of new Map(item.tags.map((tag) => [searchText(tag), tag]))) {
      const tag = await tx.tag.upsert({ where: { workspaceId_nameKey: { workspaceId, nameKey } }, create: { workspaceId, name, nameKey }, update: {} });
      tagIds.push(tag.id);
    }
    await tx.contactTag.deleteMany({ where: { workspaceId, contactId: record.id, tagId: { notIn: tagIds } } });
    if (tagIds.length) await tx.contactTag.createMany({ data: tagIds.map((tagId) => ({ workspaceId, contactId: record.id, tagId })), skipDuplicates: true });
    if (!existing || existing.statusCode !== item.status) {
      await timeline(ctx, "contact", existing ? "وضعیت مشتری تغییر کرد" : "مشتری جدید اضافه شد", { contactId: record.id, companyId: record.companyId, description: item.name });
      await event(tx, workspaceId, existing ? "contact_status_changed" : "contact_created", ctx.requestId + ":contact", { entityId: record.id, contactId: record.id, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) });
    }
    await audit(ctx, existing ? "updated" : "created", collection, record.id);
    return record.id;
  }
  if (collection === "companies") {
    if (!allRecords(actor)) throw forbidden();
    const item = recordSchemas.companies.parse(raw);
    await advisory(tx, workspaceId + ":company:" + item.id);
    const existing = await tx.company.findFirst({ where: { ...base, id: item.id } });
    const data = { name: item.name, searchKey: listKey(item.name, item.industry, item.email, item.mobile), industry: item.industry, phone: item.mobile, email: item.email, website: item.website, description: item.description };
    if (existing) await tx.company.update({ where: { id: item.id, workspaceId }, data });
    else await tx.company.create({ data: { ...data, workspaceId, id: item.id } });
    await audit(ctx, existing ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "leads") {
    const item = recordSchemas.leads.parse(raw);
    await advisory(tx, workspaceId + ":lead:" + item.id);
    const existing = await tx.lead.findFirst({ where: { ...base, ...ownerScope, id: item.id } });
    if (item.status === "converted" && existing?.statusCode !== "converted") throw invalid("برای تبدیل سرنخ از دکمهٔ تبدیل استفاده کنید.");
    await refs(ctx, item.companyId !== existing?.companyId ? item.companyId : null);
    const data = { fullName: item.name, searchKey: listKey(item.name, localPhone(item.mobile), item.mobile, item.email), mobileE164: item.mobile, email: item.email, companyId: item.companyId, ownerMembershipId: await ownerFor(ctx, item.owner, existing?.ownerMembershipId), sourceCode: item.source, statusCode: existing?.statusCode === "converted" ? "converted" : item.status, score: item.score, lastFollowUpOn: item.followUp, description: item.description };
    if (existing) await tx.lead.update({ where: { id: item.id, workspaceId }, data });
    else {
      await tx.lead.create({ data: { ...data, workspaceId, id: item.id } });
      await timeline(ctx, "lead", "سرنخ جدید ثبت شد", { leadId: item.id, companyId: item.companyId, description: item.name });
      await event(tx, workspaceId, "lead_created", "lead-create-" + item.id, { entityId: item.id, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) });
    }
    await audit(ctx, existing ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "deals") {
    const item = recordSchemas.deals.parse(raw);
    await advisory(tx, workspaceId + ":deal:" + item.id);
    const record = await tx.deal.findFirst({ where: { ...base, ...ownerScope, id: item.id } });
    if (record && record.rowVersion !== item.rowVersion) throw conflict("فرصت هم‌زمان تغییر کرده است. آن را دوباره بارگیری کنید.");
    if (!record && item.rowVersion) throw missing();
    await refs(ctx, item.companyId !== record?.companyId ? item.companyId : null, item.contactId !== record?.contactId ? item.contactId : null);
    const pipelineId = record?.pipelineId ?? (await tx.pipeline.findFirst({ where: { ...base, isDefault: true } }))?.id;
    const stage = pipelineId && await tx.pipelineStage.findFirst({ where: { ...base, pipelineId, code: item.stage } });
    if (!stage) throw invalid("مرحلهٔ قیف در دسترس نیست.");
    const data = { name: item.name, searchKey: listKey(item.name), companyId: item.companyId, contactId: item.contactId, ownerMembershipId: await ownerFor(ctx, item.owner, record?.ownerMembershipId), pipelineId: stage.pipelineId, stageId: stage.id, amountToman: item.amountToman, probabilityPct: stage.kind === "won" ? 100 : stage.kind === "lost" ? 0 : item.probability, expectedCloseOn: item.close, wonAt: stage.kind === "won" ? record?.wonAt ?? new Date() : null, description: item.description };
    if (record) await tx.deal.update({ where: { id: item.id, workspaceId }, data: { ...data, rowVersion: { increment: 1 } } });
    else await tx.deal.create({ data: { ...data, workspaceId, id: item.id } });
    if (record?.stageId !== stage.id) {
      await tx.dealStageChange.create({ data: { workspaceId, dealId: item.id, fromStageId: record?.stageId, toStageId: stage.id, changedByMembershipId: actor.membershipId } });
      await timeline(ctx, "deal", record ? "مرحلهٔ فرصت تغییر کرد" : "فرصت فروش جدید ثبت شد", { dealId: item.id, contactId: item.contactId, companyId: item.companyId, description: item.name });
      await event(tx, workspaceId, record ? "deal_stage_changed" : "deal_created", ctx.requestId + ":deal", { entityId: item.id, contactId: item.contactId, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) });
    }
    await audit(ctx, record ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "tasks") {
    const item = recordSchemas.tasks.parse(raw);
    await advisory(tx, workspaceId + ":task:" + item.id);
    const record = await tx.task.findFirst({ where: { ...base, ...taskFilter(actor), id: item.id } });
    await refs(ctx, null, item.contactId !== record?.contactId ? item.contactId : null);
    const assignment = await ownerFor(ctx, item.owner, record?.assigneeMembershipId);
    if (!assignment) throw invalid("تعیین مسئول وظیفه الزامی است.");
    const data = { name: item.name, searchKey: listKey(item.name), contactId: item.contactId, assigneeMembershipId: assignment, priorityCode: item.priority, statusCode: item.status, dueDate: item.due, dueTime: item.dueTime, completedAt: item.status === "done" ? record?.completedAt ?? new Date() : null, description: item.description };
    if (record) await tx.task.update({ where: { id: item.id, workspaceId }, data });
    else {
      await tx.task.create({ data: { ...data, workspaceId, id: item.id } });
      await timeline(ctx, "task", "وظیفهٔ جدید ثبت شد", { taskId: item.id, contactId: item.contactId, description: item.name });
      await event(tx, workspaceId, "task_created", "task-create-" + item.id, { entityId: item.id, contactId: item.contactId, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) });
    }
    const offsetMinutes = item.reminder ? reminders[item.reminder] : 0;
    const zone = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
    const scheduledAt = new Date(localInstant(item.due, item.dueTime, zone.timezone).valueOf() - offsetMinutes * 60_000);
    const reminder = await tx.taskReminder.upsert({ where: { workspaceId_taskId: { workspaceId, taskId: item.id } }, create: { workspaceId, taskId: item.id, offsetMinutes, scheduledAt, statusCode: item.status === "done" ? "cancelled" : "pending" }, update: { offsetMinutes, scheduledAt, statusCode: item.status === "done" ? "cancelled" : "pending" } });
    if (item.status !== "done") await event(tx, workspaceId, "task_due", ctx.requestId + ":due", { entityId: item.id, reminderId: reminder.id, scheduledAt: scheduledAt.toISOString(), contactId: item.contactId, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) }, scheduledAt);
    await audit(ctx, record ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "events") {
    const item = recordSchemas.events.parse(raw);
    await advisory(tx, workspaceId + ":event:" + item.id);
    const record = await tx.calendarEvent.findFirst({ where: { ...base, ...(!allRecords(actor) ? { createdByMembershipId: actor.membershipId } : {}), id: item.id } });
    await refs(ctx, null, item.contactId !== record?.contactId ? item.contactId : null);
    const data = { name: item.name, contactId: item.contactId, typeCode: item.type, eventDate: item.date, startTime: item.time, description: item.description };
    if (record) await tx.calendarEvent.update({ where: { id: item.id, workspaceId }, data });
    else await tx.calendarEvent.create({ data: { workspaceId, id: item.id, createdByMembershipId: actor.membershipId, ...data } });
    await audit(ctx, record ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "activities") {
    const item = recordSchemas.activities.parse(raw);
    await advisory(tx, workspaceId + ":activity:" + item.id);
    const record = await tx.activity.findFirst({ where: { ...base, ...(!allRecords(actor) ? { actorMembershipId: actor.membershipId } : {}), id: item.id } });
    if (record?.isSystem) throw forbidden();
    await refs(ctx, item.companyId !== record?.companyId ? item.companyId : null, item.contactId !== record?.contactId ? item.contactId : null);
    const data = { name: item.name, searchKey: listKey(item.name, item.description), kindCode: item.type, description: item.description, companyId: item.companyId, contactId: item.contactId, actorMembershipId: await ownerFor(ctx, item.owner, record?.actorMembershipId) };
    if (record) await tx.activity.update({ where: { id: item.id, workspaceId }, data });
    else await tx.activity.create({ data: { workspaceId, id: item.id, ...data } });
    await audit(ctx, record ? "updated" : "created", collection, item.id);
    return item.id;
  }
  if (collection === "templates") {
    requirePermission(actor, "sms.send");
    const item = recordSchemas.templates.parse(raw);
    const record = await tx.smsTemplate.findFirst({ where: { ...base, id: item.id } });
    if (record) await tx.smsTemplate.update({ where: { id: item.id, workspaceId }, data: { name: item.name, bodyTemplate: item.text } });
    else await tx.smsTemplate.create({ data: { id: item.id, workspaceId, name: item.name, bodyTemplate: item.text } });
    await audit(ctx, record ? "updated" : "created", collection, item.id);
    return item.id;
  }
  throw missing();
}

export async function convertLead(ctx: Mutation, leadId: string) {
  const { tx, actor } = ctx;
  requirePermission(actor, "crm.write");
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":lead:" + leadId);
  const lead = await tx.lead.findFirst({ where: { ...contactScope(actor), id: leadId } });
  if (!lead) throw missing();
  if (lead.convertedContactId) return lead.convertedContactId;
  const contact = await tx.contact.create({ data: { workspaceId, fullName: lead.fullName, mobileE164: lead.mobileE164, email: lead.email, companyId: lead.companyId, ownerMembershipId: lead.ownerMembershipId, sourceCode: lead.sourceCode, description: lead.description, searchKey: lead.searchKey, statusCode: "potential" } });
  await tx.lead.update({ where: { id: lead.id, workspaceId }, data: { statusCode: "converted", convertedContactId: contact.id, convertedAt: new Date() } });
  await timeline(ctx, "contact", "سرنخ به مشتری تبدیل شد", { contactId: contact.id, companyId: lead.companyId, leadId, description: lead.fullName });
  await event(tx, workspaceId, "contact_created", "lead-converted-" + leadId, { entityId: contact.id, contactId: contact.id, actorId: actor.membershipId, ...(ctx.cause ? { path: ctx.cause } : {}) });
  await audit(ctx, "converted", "leads", leadId);
  return contact.id;
}

export async function addNote(ctx: Mutation, collection: "contacts" | "companies", id: string, text: string) {
  const { tx, actor } = ctx;
  requirePermission(actor, "crm.write");
  const contact = collection === "contacts" ? await tx.contact.findFirst({ where: { ...contactScope(actor), id } }) : null;
  const company = collection === "companies" ? await tx.company.findFirst({ where: { ...companyScope(actor), id } }) : null;
  if (!contact && !company) throw missing();
  const item = await tx.note.create({ data: { workspaceId: actor.workspaceId, contactId: contact?.id, companyId: company?.id, authorMembershipId: actor.membershipId, text } });
  await timeline(ctx, "note", "یادداشت ثبت شد", { contactId: contact?.id, companyId: company?.id ?? contact?.companyId, noteId: item.id, description: text });
  return item.id;
}

export async function archive(ctx: Mutation, collection: Collection, ids: string[]) {
  const { tx, actor } = ctx;
  requirePermission(actor, "crm.write");
  const base = { ...live(actor), id: { in: ids } };
  const data = { deletedAt: new Date() };
  let count: number;
  switch (collection) {
    case "contacts": ({ count } = await tx.contact.updateMany({ where: { ...base, ...ownerFilter(actor) }, data })); break;
    case "companies":
      if (!allRecords(actor)) throw forbidden();
      ({ count } = await tx.company.updateMany({ where: base, data })); break;
    case "leads": ({ count } = await tx.lead.updateMany({ where: { ...base, ...ownerFilter(actor) }, data })); break;
    case "deals": ({ count } = await tx.deal.updateMany({ where: { ...base, ...ownerFilter(actor) }, data })); break;
    case "tasks":
      ({ count } = await tx.task.updateMany({ where: { ...base, ...taskFilter(actor) }, data }));
      await tx.taskReminder.updateMany({ where: { workspaceId: actor.workspaceId, taskId: { in: ids } }, data: { statusCode: "cancelled" } }); break;
    case "events": ({ count } = await tx.calendarEvent.updateMany({ where: { ...base, ...(!allRecords(actor) ? { createdByMembershipId: actor.membershipId } : {}) }, data })); break;
    case "activities": ({ count } = await tx.activity.updateMany({ where: { ...base, isSystem: false, ...(!allRecords(actor) ? { actorMembershipId: actor.membershipId } : {}) }, data })); break;
    case "templates": requirePermission(actor, "sms.send"); ({ count } = await tx.smsTemplate.updateMany({ where: base, data })); break;
    case "workflows": requirePermission(actor, "automation.manage"); ({ count } = await tx.workflow.updateMany({ where: base, data: { ...data, activeVersionId: null, nextRunAt: null } })); break;
    default: throw forbidden();
  }
  if (count !== ids.length) throw missing();
  for (const id of ids) await audit(ctx, "archived", collection, id);
  return ids.length;
}
