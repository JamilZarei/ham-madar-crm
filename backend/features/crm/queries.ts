import type { Prisma } from "@database/generated/prisma/client";
import { workspace, type Tx } from "@database/client";
import { forbidden, missing } from "@backend/lib/errors/domain";
import { activityType, contactState, eventType, leadState, priorityType, reminderName, sourceType, stageType, taskState } from "@shared/codes";
import { allRecords, has, ownerFilter, requirePermission, taskFilter, type Actor } from "@backend/lib/permissions/policy";
import { isoDate, isoTime, localPhone } from "@backend/lib/validations/common";
import { searchText } from "@shared/utils";
import { type Company, type Contact, type Lead, type Deal, type Task, type CalendarEvent, type Activity } from "@shared/model";
import { findWorkflow, recentWorkflows } from "@backend/features/automations/graph";
import { recentMessages } from "@backend/features/sms/service";
import { activityScope, companyScope, live } from "./domain";
import { type Collection, type ListQuery } from "./schemas";

const user = { select: { user: { select: { fullName: true } } } } as const;
const companyName = { select: { name: true } } as const;
const notes = { orderBy: { createdAt: "desc" as const }, take: 40 };
const contactInclude = (detail = false) => ({ owner: user, company: companyName, tags: { include: { tag: true } }, notes: detail ? notes : false });
const dealInclude = { owner: user, stage: { select: { code: true } }, company: companyName };
const taskInclude = { assignee: user, reminder: true };
const leadInclude = { owner: user };
const activityInclude = { actor: user };
const noteDto = (note: { id: string; text: string; createdAt: Date }) => ({ id: note.id, text: note.text, date: note.createdAt.toISOString() });
export const contactDto = (row: Prisma.ContactGetPayload<{ include: ReturnType<typeof contactInclude> }>): Contact => ({
  id: row.id, name: row.fullName, mobile: localPhone(row.mobileE164), email: row.email || "", companyId: row.companyId || "", companyName: row.company?.name, role: row.jobTitle || "",
  status: contactState.label(row.statusCode), source: row.sourceCode ? sourceType.label(row.sourceCode) : "", description: row.description || "",
  tags: row.tags.map(({ tag }) => tag.name), notes: row.notes?.map(noteDto) || [], created: row.createdAt.toISOString(), owner: row.owner?.user.fullName || "", ownerId: row.ownerMembershipId || "",
});
export const companyDto = (row: Prisma.CompanyGetPayload<{ include: { notes: true } }>): Company => ({
  id: row.id, name: row.name, industry: row.industry || "", mobile: row.phone || "", email: row.email || "", website: row.website || "", description: row.description || "", notes: row.notes?.map(noteDto) || [], created: row.createdAt.toISOString(),
});
export const leadDto = (row: Prisma.LeadGetPayload<{ include: typeof leadInclude }>): Lead => ({
  id: row.id, name: row.fullName, mobile: localPhone(row.mobileE164), email: row.email || "", companyId: row.companyId || "", source: row.sourceCode ? sourceType.label(row.sourceCode) : "", status: leadState.label(row.statusCode), score: row.score, owner: row.owner?.user.fullName || "", ownerId: row.ownerMembershipId || "", followUp: isoDate(row.lastFollowUpOn), description: row.description || "", created: row.createdAt.toISOString(),
});
export const dealDto = (row: Prisma.DealGetPayload<{ include: typeof dealInclude }>): Deal => ({
  id: row.id, name: row.name, companyId: row.companyId || "", companyName: row.company?.name, contactId: row.contactId || "", stage: stageType.label(row.stage.code),
  amountToman: row.amountToman.toFixed(0), value: Number(row.amountToman), rowVersion: row.rowVersion, probability: row.probabilityPct, owner: row.owner?.user.fullName || "", ownerId: row.ownerMembershipId || "", close: isoDate(row.expectedCloseOn), wonAt: row.wonAt?.toISOString(), description: row.description || "", created: row.createdAt.toISOString(),
});
export const taskDto = (row: Prisma.TaskGetPayload<{ include: typeof taskInclude }>): Task => ({
  id: row.id, name: row.name, contactId: row.contactId || "", owner: row.assignee.user.fullName, ownerId: row.assigneeMembershipId, priority: priorityType.label(row.priorityCode), status: taskState.label(row.statusCode), due: isoDate(row.dueDate), dueTime: isoTime(row.dueTime), reminder: reminderName(row.reminder?.offsetMinutes), description: row.description || "", created: row.createdAt.toISOString(),
});
export const eventDto = (row: Prisma.CalendarEventGetPayload<Record<string, never>>): CalendarEvent => ({
  id: row.id, name: row.name, type: eventType.label(row.typeCode), contactId: row.contactId || "", date: isoDate(row.eventDate), time: isoTime(row.startTime), description: row.description || "",
});
export const activityDto = (row: Prisma.ActivityGetPayload<{ include: typeof activityInclude }>): Activity => ({
  id: row.id, name: row.name, description: row.description || "", type: activityType.label(row.kindCode), owner: row.actor?.user.fullName || "سامانه", ownerId: row.actorMembershipId || "", contactId: row.contactId || undefined, companyId: row.companyId || undefined, date: row.occurredAt.toISOString(), isSystem: row.isSystem,
});

function ordering<T>(query: ListQuery, allowed: Record<string, string>, fallback = "createdAt"): T[] {
  const path = Object.hasOwn(allowed, query.sort) ? allowed[query.sort] : fallback;
  const expression = path.split(".").reverse().reduce<unknown>((nested, key) => ({ [key]: nested }), query.direction);
  return [expression, { id: "asc" }] as T[];
}
async function page<T, U>(load: Promise<T[]>, count: Promise<number>, map: (record: T) => U) {
  const [rows, total] = await Promise.all([load, count]);
  return { rows: rows.map(map), total };
}
const code = (value: string | undefined, lookup: { find: (input: string) => string | undefined }) => value ? lookup.find(value) ?? "__invalid__" : undefined;

export async function readRecords(tx: Tx, actor: Actor, collection: Collection, query: ListQuery, id?: string) {
  requirePermission(actor, "crm.read");
  const window = { skip: id ? 0 : query.page * query.size, take: id ? 1 : query.size };
  const base = { ...live(actor), ...(id ? { id } : {}) };
  const search = searchText(query.search);
  const key = search ? { contains: search } : undefined;
  const owner = ownerFilter(actor);
  switch (collection) {
    case "contacts": {
      const where = { ...base, ...owner, statusCode: code(query.status, contactState), sourceCode: code(query.source, sourceType),
        ...(search ? { OR: [{ searchKey: key }, { company: { searchKey: key } }, { tags: { some: { tag: { nameKey: key } } } }] } : {}) };
      const orderBy = ordering<Prisma.ContactOrderByWithRelationInput>(query, { name: "fullName", mobile: "mobileE164", email: "email", company: "company.name", status: "statusCode", owner: "owner.user.fullName", created: "createdAt" });
      return page(tx.contact.findMany({ where, ...window, orderBy, include: contactInclude(!!id) }), tx.contact.count({ where }), contactDto);
    }
    case "companies": {
      const where = { ...companyScope(actor), ...(id ? { id } : {}), searchKey: key };
      const orderBy = ordering<Prisma.CompanyOrderByWithRelationInput>(query, { name: "name", industry: "industry", mobile: "phone", email: "email", created: "createdAt" });
      const include = { notes: id ? { ...notes, ...(allRecords(actor) ? {} : { where: { authorMembershipId: actor.membershipId } }) } : false,
        _count: { select: { contacts: { where: { ...owner, deletedAt: null } } } } };
      return page(tx.company.findMany({ where, ...window, orderBy, include }), tx.company.count({ where }), (row) => ({ ...companyDto(row), personCount: row._count.contacts }));
    }
    case "leads": {
      const where = { ...base, ...owner, searchKey: key, statusCode: code(query.status, leadState), sourceCode: code(query.source, sourceType) };
      const orderBy = ordering<Prisma.LeadOrderByWithRelationInput>(query, { name: "fullName", score: "score", source: "sourceCode", status: "statusCode", owner: "owner.user.fullName", followUp: "lastFollowUpOn" });
      return page(tx.lead.findMany({ where, ...window, orderBy, include: leadInclude }), tx.lead.count({ where }), leadDto);
    }
    case "deals": {
      const where = { ...base, ...owner, ...(query.stage ? { stage: { code: code(query.stage, stageType) } } : {}),
        ...(search ? { OR: [{ searchKey: key }, { company: { searchKey: key } }, { owner: { user: { fullName: { contains: query.search, mode: "insensitive" as const } } } }] } : {}) };
      const orderBy = ordering<Prisma.DealOrderByWithRelationInput>(query, { name: "name", company: "company.name", stage: "stage.sortOrder", value: "amountToman", probability: "probabilityPct", owner: "owner.user.fullName", close: "expectedCloseOn" });
      return page(tx.deal.findMany({ where, ...window, orderBy, include: dealInclude }), tx.deal.count({ where }), dealDto);
    }
    case "tasks": {
      const where = { ...base, ...taskFilter(actor), statusCode: code(query.status, taskState), priorityCode: code(query.priority, priorityType),
        ...(search ? { OR: [{ searchKey: key }, { description: { contains: query.search, mode: "insensitive" as const } }, { assignee: { user: { fullName: { contains: query.search, mode: "insensitive" as const } } } }] } : {}) };
      const orderBy = ordering<Prisma.TaskOrderByWithRelationInput>(query, { name: "name", owner: "assignee.user.fullName", due: "dueDate", status: "statusCode", reminder: "reminder.offsetMinutes", priority: "priorityCode" });
      return page(tx.task.findMany({ where, ...window, orderBy, include: taskInclude }), tx.task.count({ where }), taskDto);
    }
    case "activities": {
      const where = { AND: [activityScope(actor), { ...(id ? { id } : {}), searchKey: key, kindCode: code(query.type, activityType) }] };
      const orderBy = ordering<Prisma.ActivityOrderByWithRelationInput>(query, { name: "name", date: "occurredAt", type: "kindCode", owner: "actor.user.fullName", contact: "contact.fullName" }, "occurredAt");
      return page(tx.activity.findMany({ where, ...window, orderBy, include: activityInclude }), tx.activity.count({ where }), activityDto);
    }
    case "events": {
      const where = { ...base, ...(!allRecords(actor) ? { createdByMembershipId: actor.membershipId } : {}) };
      return page(tx.calendarEvent.findMany({ where, ...window, orderBy: { eventDate: "asc" } }), tx.calendarEvent.count({ where }), eventDto);
    }
    case "templates": {
      requirePermission(actor, "sms.send");
      return page(tx.smsTemplate.findMany({ where: base, ...window, orderBy: { createdAt: "desc" } }), tx.smsTemplate.count({ where: base }), ({ id, name, bodyTemplate }) => ({ id, name, text: bodyTemplate }));
    }
    case "workflows": {
      requirePermission(actor, "automation.manage");
      if (id) return { rows: [await findWorkflow(tx, actor, id)], total: 1 };
      return recentWorkflows(tx, actor, query.search, query.status ? query.status === "فعال" : undefined, window.skip, window.take);
    }
    case "sms": return recentMessages(tx, actor, query, window);
  }
}
export async function recordPage(actor: Actor, collection: Collection, query: ListQuery, id?: string) {
  return workspace(actor.workspaceId, async (tx) => {
    const result = await readRecords(tx, actor, collection, query, id);
    if (id && !result.rows.length) throw missing();
    return result;
  });
}
export async function searchWorkspace(actor: Actor, query: string) {
  return workspace(actor.workspaceId, async (tx) => {
    if (!has(actor, "crm.read")) throw forbidden();
    const opts: ListQuery = { page: 0, size: 6, search: query, sort: "", direction: "desc" };
    const [contacts, companies, deals] = await Promise.all(["contacts", "companies", "deals"].map((collection) => readRecords(tx, actor, collection as Collection, opts)));
    return { contacts: contacts.rows, companies: companies.rows, deals: deals.rows };
  });
}
