import { workspace, type Tx } from "@database/client";
import { allRecords, has, ownerFilter, requirePermission, type Actor } from "@backend/lib/permissions/policy";
import { dateOnly } from "@backend/lib/validations/common";
import { invalid } from "@backend/lib/errors/domain";
import { activityType, sourceType, stageType } from "@shared/codes";
import { activityScope, live, localInstant } from "@backend/features/crm/domain";
import type { Sale } from "@shared/model";

export function workspaceDay(timezone: string, instant = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return parts.year + "-" + parts.month + "-" + parts.day;
}
export function offsetDay(value: string, days: number) {
  return new Date(dateOnly(value).valueOf() + days * 86_400_000).toISOString().slice(0, 10);
}
const midnight = new Date("1970-01-01T00:00:00Z");
function range(from: string, to: string, zone: string) {
  if (from > to || dateOnly(to).valueOf() - dateOnly(from).valueOf() > 366 * 86_400_000) throw invalid("بازهٔ گزارش باید معتبر و حداکثر ۳۶۶ روز باشد.");
  return { gte: localInstant(dateOnly(from), midnight, zone), lt: localInstant(dateOnly(offsetDay(to, 1)), midnight, zone) };
}
type SalesRow = { day: string; owner: string | null; owner_name: string | null; amount: string; count: bigint };
export async function salesQuery(tx: Tx, actor: Actor, from: string, to: string, timezone: string) {
  const dates = range(from, to, timezone);
  return tx.$queryRaw<SalesRow[]>`
      SELECT (d.won_at AT TIME ZONE ${timezone})::date::text AS day, d.owner_membership_id AS owner,
        a.full_name AS owner_name, sum(d.amount_toman)::text AS amount, count(*) AS count
      FROM deal d JOIN pipeline_stage s ON s.id = d.stage_id AND s.workspace_id = d.workspace_id
      LEFT JOIN membership m ON m.workspace_id = d.workspace_id AND m.id = d.owner_membership_id
      LEFT JOIN user_account a ON a.id = m.user_id
      WHERE d.workspace_id = ${actor.workspaceId}::uuid AND d.deleted_at IS NULL AND s.kind = 'won'
        AND (${allRecords(actor)} OR d.owner_membership_id = ${actor.membershipId}::uuid)
        AND d.won_at >= ${dates.gte} AND d.won_at < ${dates.lt}
      GROUP BY day, d.owner_membership_id, a.full_name ORDER BY day`;
}
export const salesDto = (rows: SalesRow[]): Sale[] => rows.map(({ day, amount, owner_name }) => ({ date: day, value: Number(amount), amountToman: amount, owner: owner_name || "بدون مسئول" }));
export async function reports(actor: Actor, input: { from?: string; to?: string }) {
  requirePermission(actor, "reports.read");
  return workspace(actor.workspaceId, async (tx) => {
    const { timezone } = await tx.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId }, select: { timezone: true } });
    const today = workspaceDay(timezone);
    const from = input.from || offsetDay(today, -29);
    const to = input.to || today;
    const interval = range(from, to, timezone);
    const base = live(actor);
    const scoped = { ...base, ...ownerFilter(actor) };
    const [sales, leads, deals, activities, sms, runs, stageNames] = await Promise.all([
      salesQuery(tx, actor, from, to, timezone),
      tx.lead.groupBy({ by: ["sourceCode", "statusCode"], where: { ...scoped, createdAt: interval }, _count: { _all: true } }),
      tx.deal.groupBy({ by: ["stageId"], where: { ...scoped, createdAt: interval }, _count: { _all: true } }),
      tx.activity.groupBy({ by: ["kindCode"], where: { ...activityScope(actor), occurredAt: interval }, _count: { _all: true } }),
      has(actor, "sms.send") ? tx.smsMessage.groupBy({ by: ["statusCode"], where: { workspaceId: actor.workspaceId, createdAt: interval }, _count: { _all: true } }) : [],
      has(actor, "automation.manage") ? tx.workflowRun.groupBy({ by: ["stateCode"], where: { workspaceId: actor.workspaceId, startedAt: interval }, _count: { _all: true } }) : [],
      tx.pipelineStage.findMany({ where: base, select: { id: true, code: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    const owners = new Map<string, { name: string; value: bigint; closed: number }>();
    for (const item of sales) {
      const key = item.owner || "";
      const data = owners.get(key) || { name: item.owner_name || "بدون مسئول", value: BigInt(0), closed: 0 };
      owners.set(key, { ...data, value: data.value + BigInt(item.amount), closed: data.closed + Number(item.count) });
    }
    const leadSources = new Map<string, { name: string; value: number; converted: number }>();
    for (const item of leads) {
      const key = item.sourceCode || "";
      const source = leadSources.get(key) || { name: key ? sourceType.label(key) : "بدون منبع", value: 0, converted: 0 };
      source.value += item._count._all;
      source.converted += item.statusCode === "converted" ? item._count._all : 0;
      leadSources.set(key, source);
    }
    const leadsCount = leads.reduce((sum, item) => sum + item._count._all, 0);
    const conversion = leadsCount ? Math.round(leads.filter((item) => item.statusCode === "converted").reduce((sum, item) => sum + item._count._all, 0) / leadsCount * 1000) / 10 : 0;
    return {
      sales: salesDto(sales), totalToman: sales.reduce((sum, row) => sum + BigInt(row.amount), BigInt(0)).toString(), conversion,
      byOwner: [...owners.values()].map((row) => ({ name: row.name, value: Number(row.value) / 1_000_000, closed: row.closed })),
      leadSources: [...leadSources.values()], funnel: stageNames.map((stage) => ({ name: stageType.label(stage.code), value: deals.find((row) => row.stageId === stage.id)?._count._all ?? 0 })),
      activityCount: activities.reduce((sum, item) => sum + item._count._all, 0),
      runCount: runs.reduce((sum, item) => sum + item._count._all, 0),
      touchpoints: activities.map((row) => ({ name: activityType.label(row.kindCode), value: row._count._all })),
      smsByStatus: ["موفق", "ناموفق", "در انتظار"].map((name, index) => ({ name, value: sms.filter((row) => index === 0 ? row.statusCode === "delivered" : index === 1 ? row.statusCode === "failed" : !["delivered", "failed"].includes(row.statusCode)).reduce((a, b) => a + b._count._all, 0) })),
      runStatuses: [["موفق", "succeeded"], ["خطا", "failed"], ["در حال اجرا", "running"]].map(([name, code]) => ({ name, value: runs.filter((row) => code === "running" ? !["succeeded", "failed"].includes(row.stateCode) : code === row.stateCode).reduce((a, b) => a + b._count._all, 0) })),
    };
  });
}
export type Report = Awaited<ReturnType<typeof reports>>;
