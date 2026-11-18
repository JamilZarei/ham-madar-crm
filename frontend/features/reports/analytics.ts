import { type CRMState, type Sale, stages, smsStatuses } from "@shared/model";
import { revenueSales } from "@/lib/sales";
import { isoDay, asDate, shortDate } from "@shared/utils";

export function reportData(state: CRMState, from: string, to: string) {
  const inRange = (value: string) => {
    const date = isoDay(asDate(value));
    return (!from || date >= from) && (!to || date <= to);
  };
  const sales = revenueSales(state).filter((item) => inRange(item.date));
  const leads = state.leads.filter((item) => inRange(item.created));
  const deals = state.deals.filter((item) => inRange(item.created));
  const activities = state.activities.filter((item) => inRange(item.date));
  const sms = state.sms.filter((item) => inRange(item.date));
  const runs = state.workflows.flatMap((workflow) => workflow.runs).filter((run) => inRange(run.date));
  const conversion = leads.length ? Math.round(1000 * leads.filter((item) => item.status === "تبدیل‌شده").length / leads.length) / 10 : 0;
  const owners = [...new Set(sales.map((sale) => sale.owner).concat(deals.map((deal) => deal.owner)).filter(Boolean))];
  const byOwner = owners.map((name) => ({ name, value: Math.round(sales.filter((sale) => sale.owner === name).reduce((sum, sale) => sum + sale.value, 0) / 1_000_000), closed: deals.filter((deal) => deal.owner === name && deal.stage === "موفق").length }));
  const leadSources = [...new Set(leads.map((lead) => lead.source || "بدون منبع"))].map((name) => {
    const group = leads.filter((lead) => (lead.source || "بدون منبع") === name);
    return { name, value: group.length, converted: group.filter((lead) => lead.status === "تبدیل‌شده").length };
  });
  return {
    sales, conversion, leads, byOwner, leadSources, deals, activities, sms, runs,
    funnel: stages.map((name) => ({ name, value: deals.filter((deal) => deal.stage === name).length })),
    touchpoints: [...new Set(activities.map((activity) => activity.type))].map((name) => ({ name, value: activities.filter((activity) => activity.type === name).length })),
    smsByStatus: smsStatuses.map((name) => ({ name, value: sms.filter((item) => item.status === name).length })),
    runStatuses: ["موفق", "خطا"].map((name) => ({ name, value: runs.filter((run) => run.result === name).length })),
  };
}
export function salesPoints(sales: Sale[]) {
  const grouped = new Map<string, number>();
  sales.forEach((sale) => grouped.set(sale.date, (grouped.get(sale.date) || 0) + sale.value));
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date: shortDate(date), amount: amount / 1_000_000 }));
}

