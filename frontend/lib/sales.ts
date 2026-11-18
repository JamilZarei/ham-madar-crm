import { type CRMState, type Sale } from "@shared/model";
import { asDate, isoDay } from "@shared/utils";

export function revenueSales(state: CRMState): Sale[] {
  if (state.dashboard) return state.sales;
  return [
    ...state.sales,
    ...state.deals.flatMap((deal) => deal.stage === "موفق" && deal.wonAt ?
      [{ date: isoDay(asDate(deal.wonAt)), value: deal.value, owner: deal.owner }] : []),
  ];
}
