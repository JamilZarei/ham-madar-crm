"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Calculator, CircleCheck, Columns3, List, Pencil, Target, Wallet } from "lucide-react";
import { toast } from "sonner";
import { type Deal, type Stage, stages, stageTone } from "@shared/model";
import { crm, useCRM } from "@/lib/repository";
import { fa, id, money, shortDate } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { choices, ownerChoices } from "@/components/record-form";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/common";
import { DealsBoard } from "./board";

export default function Deals() {
  const state = useCRM();
  const param = useSearchParams().get("stage") || "";
  const [view, setView] = useState(param ? "table" : "board");
  const [stageFilter, setStage] = useState(param);
  if (!state) return null;
  const company = (key: string) => state.companies.find((item) => item.id === key)?.name || "";
  const active = state.deals.filter((item) => !["موفق", "ناموفق"].includes(item.stage));
  async function move(item: Deal, stage: Stage) {
    if (stage === item.stage) return;
    const probability = stage === "موفق" ? 100 : stage === "ناموفق" ? 0 : ["موفق", "ناموفق"].includes(item.stage) ? [15, 35, 55, 80][stages.indexOf(stage)] : item.probability;
    try { await crm.saveDeal({ ...item, stage, probability }); toast.success("فرصت به مرحلهٔ «" + stage + "» منتقل شد."); }
    catch { toast.error("تغییر مرحله انجام نشد."); }
  }
  return <RecordPage title="فرصت‌های فروش" singular="فرصت" description="معاملات را از شناسایی تا نهایی شدن در قیف فروش دنبال کنید." list={state.deals}
    actions={<div className="segmented" aria-label="نمای فرصت‌ها"><Button size="sm" variant={view === "board" ? "soft" : "ghost"} aria-pressed={view === "board"} onClick={() => setView("board")}><Columns3 />تابلو</Button><Button size="sm" variant={view === "table" ? "soft" : "ghost"} aria-pressed={view === "table"} onClick={() => setView("table")}><List />جدول</Button></div>}
    summary={<div className="stat-grid record-stats"><Stat label="فرصت‌های فعال" value={fa(state.stats?.activeDeals ?? active.length)} icon={Target} /><Stat label="ارزش فرصت‌های فعال" value={<>{fa(Number(state.stats?.openToman ?? 0) / 1_000_000)}<small>میلیون تومان</small></>} icon={Wallet} tone="cyan" /><Stat label="ارزش وزنی فرصت‌ها" value={<>{fa(Math.round(Number(state.stats?.weightedToman ?? 0) / 1_000_000))}<small>میلیون تومان</small></>} icon={Calculator} tone="violet" /><Stat label="معامله‌های موفق" value={fa(state.stats?.wonDeals ?? 0)} icon={CircleCheck} tone="green" /></div>}
    alternate={view === "board" ? (actions) => <DealsBoard rows={state.deals} company={company} actions={actions} move={move} /> : undefined}
    filtered={state.deals.filter((item) => !stageFilter || item.stage === stageFilter)}
    filters={[{ label: "مرحله", options: stages, value: stageFilter, onChange: setStage }]}
    searchBy={(item) => [item.name, (item.companyName ?? company(item.companyId)), item.owner].join(" ")}
    columns={({ show }) => [
      { accessorKey: "name", header: "عنوان فرصت", cell: ({ row }) => <button className="record-link" onClick={() => show(row.original)}>{row.original.name}</button> },
      { id: "company", accessorFn: (item) => (item.companyName ?? company(item.companyId)), header: "شرکت", cell: ({ getValue }) => String(getValue() || "—") },
      { accessorKey: "stage", header: "مرحله", cell: ({ row }) => <Badge tone={stageTone[row.original.stage]}>{row.original.stage}</Badge> },
      { accessorKey: "value", header: "ارزش معامله", cell: ({ row }) => money(row.original.amountToman ?? row.original.value) },
      { accessorKey: "probability", header: "احتمال موفقیت", cell: ({ row }) => fa(row.original.probability) + "٪" },
      { accessorKey: "owner", header: "کارشناس" }, { accessorKey: "close", header: "بسته‌شدن پیش‌بینی‌شده", cell: ({ row }) => shortDate(row.original.close) },
    ]}
    fields={[
      { key: "name", label: "عنوان فرصت", required: true, wide: true }, { key: "companyId", label: "شرکت", kind: "select", options: choices(state.companies) },
      { key: "contactId", label: "مشتری", kind: "select", options: choices(state.contacts) }, { key: "stage", label: "مرحله", kind: "select", options: stages, required: true },
      { key: "value", label: "ارزش معامله (تومان)", kind: "number", required: true }, { key: "probability", label: "احتمال موفقیت (درصد)", kind: "number", max: 100, required: true },
      { key: "owner", label: "کارشناس", kind: "select", options: ownerChoices(state.settings.users) }, { key: "close", label: "بسته‌شدن پیش‌بینی‌شده", kind: "date" },
      { key: "description", label: "توضیحات", kind: "textarea" },
    ]}
    defaults={(item) => item ? { ...item, owner: item.ownerId, value: item.amountToman ?? item.value } : { stage: "شناسایی", probability: 15, owner: state.settings.membershipId }}
    save={(values, item) => {
      const { name, companyId, contactId, owner, close, description } = values;
      const stage = values.stage as Stage;
      return crm.saveDeal({ id: item?.id || id(), name, companyId, contactId, owner, close, description, stage, value: Number(values.value), amountToman: values.value, rowVersion: item?.rowVersion, probability: stage === "موفق" ? 100 : stage === "ناموفق" ? 0 : Number(values.probability), created: item?.created || new Date().toISOString() });
    }}
    remove={(ids) => crm.remove("deals", ids)}
    details={(item, actions) => <div className="stack"><div className="spread"><Badge tone={stageTone[item.stage]}>{item.stage}</Badge><Button variant="outline" onClick={() => actions.edit(item)}><Pencil />ویرایش</Button></div>
      <Details rows={[["ارزش معامله", money(item.amountToman ?? item.value)], ["احتمال موفقیت", fa(item.probability) + "٪"], ["کارشناس", item.owner], ["بسته‌شدن پیش‌بینی‌شده", shortDate(item.close)], ["شرکت", item.companyId && <Link className="text-link" href={"/companies/?id=" + item.companyId}>{(item.companyName ?? company(item.companyId))}</Link>], ["مشتری", item.contactId && <Link className="text-link" href={"/contacts/?id=" + item.contactId}>{state.contacts.find((contact) => contact.id === item.contactId)?.name}</Link>]]} />{item.description && <p>{item.description}</p>}</div>}
  />;
}
