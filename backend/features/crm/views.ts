import { workspace, type Tx } from "@database/client";
import { allRecords, has, ownerFilter, requirePermission, taskFilter, type Actor } from "@backend/lib/permissions/policy";
import { type Activity, type Company, type Contact, type CRMState, type Deal, type Lead, type Task, type Template, type Workflow } from "@shared/model";
import { invalid } from "@backend/lib/errors/domain";
import { dateOnly } from "@backend/lib/validations/common";
import { activityScope, live } from "./domain";
import { activityDto, contactDto, dealDto, eventDto, readRecords, taskDto } from "./queries";
import { profileDto } from "@backend/features/users/service";
import { offsetDay, salesDto, salesQuery, workspaceDay } from "@backend/features/reports/report";
import { type Collection, type ListQuery } from "./schemas";

export const sections = ["dashboard", "contacts", "companies", "leads", "deals", "tasks", "calendar", "activities", "sms", "automations", "reports", "settings"] as const;
type Section = (typeof sections)[number];
const def = (size: number): ListQuery => ({ page: 0, size, search: "", sort: "", direction: "desc" });
const selectOwner = { select: { user: { select: { fullName: true } } } } as const;

async function dashboardStats(tx: Tx, actor: Actor): Promise<NonNullable<CRMState["stats"]>> {
  const scoped = { ...live(actor), ...ownerFilter(actor) };
  const workspaceId = actor.workspaceId;
  const [contacts, leads, deals, workflows, workflowsEnabled, workflowRuns, sms] = await Promise.all([
    tx.contact.groupBy({ by: ["statusCode"], where: scoped, _count: { _all: true } }),
    tx.lead.groupBy({ by: ["statusCode"], where: scoped, _count: { _all: true } }),
    tx.$queryRaw<{ kind: string; count: bigint; value: string; weighted: string }[]>`
      SELECT s.kind, count(*) count, sum(d.amount_toman)::text value, round(sum(d.amount_toman*d.probability_pct/100))::text weighted
      FROM deal d JOIN pipeline_stage s ON s.id=d.stage_id AND s.workspace_id=d.workspace_id
      WHERE d.workspace_id=${workspaceId}::uuid AND d.deleted_at IS NULL
        AND (${allRecords(actor)} OR d.owner_membership_id=${actor.membershipId}::uuid) GROUP BY s.kind`,
    has(actor, "automation.manage") ? tx.workflow.count({ where: { ...live(actor), versions: { some: { isDraft: false } } } }) : 0,
    has(actor, "automation.manage") ? tx.workflow.count({ where: { ...live(actor), activeVersionId: { not: null } } }) : 0,
    has(actor, "automation.manage") ? tx.workflowRun.count({ where: { workspaceId } }) : 0,
    has(actor, "sms.send") ? tx.smsMessage.groupBy({ by: ["statusCode"], where: { workspaceId }, _count: { _all: true } }) : [],
  ]);
  const contactCount = (status: string) => contacts.find((row) => row.statusCode === status)?._count._all || 0;
  const leadCount = (status: string) => leads.find((row) => row.statusCode === status)?._count._all || 0;
  const open = deals.find((row) => row.kind === "open");
  return {
    contacts: contacts.reduce((n, row) => n + row._count._all, 0), activeContacts: contactCount("active"), negotiations: contactCount("negotiating"), inactiveContacts: contactCount("inactive"), joined: 0,
    activeDeals: Number(open?.count ?? 0), openToman: open?.value ?? "0", weightedToman: open?.weighted ?? "0", wonDeals: Number(deals.find((row) => row.kind === "won")?.count ?? 0),
    leads: leads.reduce((n, row) => n + row._count._all, 0), newLeads: leadCount("new"), convertedLeads: leadCount("converted"), qualifiedLeads: leadCount("qualified"), workflowCount: workflows, enabledWorkflows: workflowsEnabled, workflowRuns,
    sms: sms.reduce((n, row) => n + row._count._all, 0), smsDelivered: sms.find((row) => row.statusCode === "delivered")?._count._all ?? 0,
    smsFailed: sms.find((row) => row.statusCode === "failed")?._count._all ?? 0, smsPending: sms.filter((row) => !["failed", "delivered"].includes(row.statusCode)).reduce((n, row) => n + row._count._all, 0),
  };
}
export async function calendarRange(actor: Actor, from: string, to: string) {
  requirePermission(actor, "crm.read");
  return workspace(actor.workspaceId, (tx) => calendarRows(tx, actor, from, to));
}
async function calendarRows(tx: Tx, actor: Actor, from: string, to: string) {
  const earliest = dateOnly(from);
  const latest = dateOnly(to);
  if (latest < earliest || latest.valueOf() - earliest.valueOf() > 92 * 86_400_000) throw invalid("بازهٔ تقویم معتبر نیست.");
  const day = { gte: earliest, lte: latest };
  const [events, tasks] = await Promise.all([
    tx.calendarEvent.findMany({ where: { ...live(actor), ...(!allRecords(actor) ? { createdByMembershipId: actor.membershipId } : {}), eventDate: day }, take: 500, orderBy: [{ eventDate: "asc" }, { id: "asc" }] }),
    tx.task.findMany({ where: { ...live(actor), ...taskFilter(actor), dueDate: day }, take: 500, orderBy: [{ dueDate: "asc" }, { id: "asc" }], include: { assignee: selectOwner, reminder: true } }),
  ]);
  return { events: events.map(eventDto), tasks: tasks.map(taskDto) };
}
export async function workspaceView(actor: Actor, section: Section, selected?: string): Promise<CRMState> {
  return workspace(actor.workspaceId, async (tx) => {
    const settings = await profileDto(tx, actor);
    const state: CRMState = { contacts: [], companies: [], leads: [], deals: [], tasks: [], events: [], activities: [], sms: [], templates: [], workflows: [], settings, sales: [] };
    const workspaceId = actor.workspaceId;
    const { timezone } = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } });
    const today = workspaceDay(timezone);
    state.notifications = settings.notifications ? (await tx.notification.findMany({ where: { workspaceId, recipientMembershipId: actor.membershipId, ...(settings.taskAlerts ? {} : { kindCode: { not: "task_due" } }) }, take: 12, orderBy: { createdAt: "desc" }, include: { reminder: { select: { taskId: true } } } })).map((item) => ({ id: item.id, name: item.name, body: item.body || "", read: !!item.readAt, taskId: item.reminder?.taskId })) : [];
    if (!has(actor, "crm.read")) return state;
    const fill = async <K extends Collection>(collection: K, limit: number, id?: string) => {
      const result = await readRecords(tx, actor, collection, def(limit), id);
      return result.rows;
    };
    if (["contacts", "leads", "deals", "tasks", "calendar", "activities", "sms"].includes(section)) {
      const results = await Promise.all([fill("companies", 35), fill("contacts", 35)]);
      state.companies = results[0] as Company[];
      state.contacts = results[1] as Contact[];
    }
    if (["dashboard", "contacts", "leads", "deals", "automations", "sms"].includes(section)) state.stats = await dashboardStats(tx, actor);
    if (section === "contacts" && selected) {
      const target = (await fill("contacts", 1, selected) as Contact[])[0];
      if (target) {
        state.contacts = [target, ...state.contacts.filter((item) => item.id !== target.id)];
        state.activities = (await tx.activity.findMany({ where: { AND: [activityScope(actor), { contactId: selected }] }, take: 40, orderBy: { occurredAt: "desc" }, include: { actor: selectOwner } })).map(activityDto);
      }
    }
    if (section === "companies") {
      state.companies = await fill("companies", 8) as Company[];
      if (selected) {
        const company = (await fill("companies", 1, selected) as Company[])[0];
        if (company) {
          state.companies = [company, ...state.companies.filter((item) => item.id !== company.id)];
          state.contacts = (await tx.contact.findMany({ where: { ...live(actor), ...ownerFilter(actor), companyId: selected }, take: 50, include: { owner: selectOwner, tags: { include: { tag: true } }, company: { select: { name: true } } } })).map((item) => contactDto({ ...item, notes: [] }));
          state.deals = (await tx.deal.findMany({ where: { ...live(actor), ...ownerFilter(actor), companyId: selected }, take: 50, include: { owner: selectOwner, stage: { select: { code: true } }, company: { select: { name: true } } } })).map(dealDto);
          state.activities = (await tx.activity.findMany({ where: { AND: [activityScope(actor), { companyId: selected }] }, take: 40, orderBy: { occurredAt: "desc" }, include: { actor: selectOwner } })).map(activityDto);
        }
      }
    }
    if (section === "leads") state.leads = await fill("leads", 8, selected) as Lead[];
    if (section === "deals") {
      const stages = await tx.pipelineStage.findMany({ where: { ...live(actor), pipeline: { isDefault: true, deletedAt: null } }, select: { code: true }, orderBy: { sortOrder: "asc" } });
      state.deals = (await Promise.all(stages.map((stage) => readRecords(tx, actor, "deals", { ...def(24), stage: stage.code })))).flatMap((part) => part.rows as Deal[]);
      if (selected && !state.deals.some((item) => item.id === selected)) state.deals.push(...await fill("deals", 1, selected) as Deal[]);
    }
    if (section === "tasks") state.tasks = await fill("tasks", 8, selected) as Task[];
    if (section === "calendar") Object.assign(state, await calendarRows(tx, actor, offsetDay(today, -35), offsetDay(today, 42)));
    if (section === "activities") state.activities = await fill("activities", 8, selected) as Activity[];
    if (section === "sms" && has(actor, "sms.send")) state.templates = await fill("templates", 50) as Template[];
    if (section === "automations" && has(actor, "automation.manage")) state.workflows = await fill("workflows", 8, selected) as Workflow[];
    if (section === "dashboard") {
      const from = offsetDay(today, -119);
      const base = { ...live(actor), ...ownerFilter(actor) };
      const daily = (await tx.$queryRaw<{ day: string; count: bigint; kind: string }[]>`
        SELECT (created_at AT TIME ZONE ${timezone})::date::text AS day, count(*) AS count, 'contact' AS kind FROM contact
        WHERE workspace_id=${workspaceId}::uuid AND deleted_at IS NULL AND (created_at AT TIME ZONE ${timezone})::date >= ${from}::date
          AND (${allRecords(actor)} OR owner_membership_id = ${actor.membershipId}::uuid) GROUP BY day
        UNION ALL
        SELECT (created_at AT TIME ZONE ${timezone})::date::text AS day, count(*) AS count, status_code AS kind FROM lead
        WHERE workspace_id=${workspaceId}::uuid AND deleted_at IS NULL AND (created_at AT TIME ZONE ${timezone})::date >= ${from}::date
          AND (${allRecords(actor)} OR owner_membership_id = ${actor.membershipId}::uuid) GROUP BY day,status_code`);
      const [sales, contacts, tasks, activities, funnel, todayTasks] = await Promise.all([
        salesQuery(tx, actor, from, today, timezone), fill("contacts", 4) as Promise<Contact[]>,
        tx.task.findMany({ where: { ...live(actor), ...taskFilter(actor), statusCode: { not: "done" } }, take: 4, orderBy: [{ dueDate: "asc" }, { id: "asc" }], include: { assignee: selectOwner, reminder: true } }),
        fill("activities", 4) as Promise<Activity[]>,
        tx.deal.groupBy({ by: ["stageId"], where: base, _count: { _all: true } }),
        tx.task.count({ where: { ...live(actor), ...taskFilter(actor), dueDate: dateOnly(today), statusCode: { not: "done" } } }),
      ]);
      const stages = await tx.pipelineStage.findMany({ where: { ...live(actor), pipeline: { isDefault: true }, kind: { not: "lost" } }, orderBy: { sortOrder: "asc" } });
      state.sales = salesDto(sales);
      state.contacts = contacts;
      state.companies = await fill("companies", 35) as Company[];
      state.tasks = tasks.map(taskDto);
      state.activities = activities;
      state.dashboard = { today, todayTasks, daily: daily.map((row) => ({ ...row, count: Number(row.count) })), funnel: stages.map((stage) => ({ stage: stage.name, count: funnel.find((row) => row.stageId === stage.id)?._count._all ?? 0 })) };
    }
    return state;
  });
}
