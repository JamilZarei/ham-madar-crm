import { type CRMState, stages } from "@shared/model";
import { revenueSales } from "@/lib/sales";
import { asDate, isoDay, shortDate, today } from "@shared/utils";

export function dashboardData(state: CRMState, days: number) {
  const reference = state.dashboard ? asDate(state.dashboard.today) : today();
  const day = (offset: number) => { const value = new Date(reference); value.setDate(value.getDate() + offset); return isoDay(value); };
  const edge = day(1 - days);
  const previousEdge = day(1 - 2 * days);
  const sales = revenueSales(state);
  const currentSales = sales.filter((sale) => sale.date >= edge);
  const previousSales = sales.filter((sale) => sale.date >= previousEdge && sale.date < edge);
  const income = currentSales.reduce((sum, sale) => sum + sale.value, 0);
  const previousIncome = previousSales.reduce((sum, sale) => sum + sale.value, 0);
  const activeDeals = state.deals.filter((deal) => deal.stage !== "موفق" && deal.stage !== "ناموفق");
  const daily = state.dashboard?.daily.filter((row) => row.day >= edge) ?? [];
  const newContacts = daily.filter((row) => row.kind === "contact").reduce((total, row) => total + row.count, 0);
  const leadsInRange = daily.filter((row) => row.kind !== "contact").reduce((total, row) => total + row.count, 0);
  const conversion = leadsInRange ? Math.round(1000 * daily.filter((row) => row.kind === "converted").reduce((total, row) => total + row.count, 0) / leadsInRange) / 10 : 0;
  const tasksToday = state.dashboard?.todayTasks ?? 0;
  const step = days > 30 ? 3 : 1;
  const byDate = new Map<string, number>();
  sales.forEach((sale) => byDate.set(sale.date, (byDate.get(sale.date) || 0) + sale.value));
  const points = Array.from({ length: Math.ceil(days / step) }, (_, index) => {
    const offset = 1 - days + index * step;
    const start = day(offset);
    const collect = (shift: number) => Array.from({ length: step }, (_, item) => byDate.get(day(offset + item - shift)) ?? 0).reduce((a, b) => a + b, 0);
    return { date: shortDate(start), amount: collect(0) / 1_000_000, previous: collect(days) / 1_000_000 };
  });
  return { income, change: previousIncome ? (income - previousIncome) / previousIncome * 100 : null, activeDeals, newContacts, conversion, tasksToday, points,
    funnel: state.dashboard?.funnel ?? stages.slice(0, -1).map((stage) => ({ stage, count: state.deals.filter((deal) => deal.stage === stage).length })),
  };
}
