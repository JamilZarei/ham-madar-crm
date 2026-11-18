"use client";

import { useState } from "react";
import { ArrowLeft, CircleCheck, Pencil, Target, UserRoundCheck, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { leadStatuses, sources, type Lead, type LeadStatus } from "@shared/model";
import { crm, useCRM } from "@/lib/repository";
import { fa, id, shortDate } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { choices, ownerChoices } from "@/components/record-form";
import { Badge, MenuItem, PersonAvatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/common";

const leadTone = ["cyan", "indigo", "violet", "red", "green"];
async function convert(lead: Lead) {
  try { await crm.convertLead(lead.id); toast.success(lead.name + " به مشتری تبدیل شد."); }
  catch (error) { toast.error(error instanceof Error ? error.message : "تبدیل سرنخ انجام نشد."); }
}
export default function Leads() {
  const state = useCRM();
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  if (!state) return null;
  return <RecordPage title="سرنخ‌های فروش" singular="سرنخ" description="سرنخ‌ها را اولویت‌بندی کنید و مشتریان بالقوه را به مشتری تبدیل کنید." list={state.leads}
    summary={<div className="stat-grid record-stats"><Stat label="کل سرنخ‌ها" icon={Target} value={fa(state.stats?.leads ?? 0)} /><Stat label="سرنخ‌های جدید" icon={UserRoundPlus} tone="cyan" value={fa(state.stats?.newLeads ?? 0)} /><Stat label="واجد شرایط" icon={CircleCheck} tone="violet" value={fa(state.stats?.qualifiedLeads ?? 0)} /><Stat label="تبدیل‌شده" icon={UserRoundCheck} tone="green" value={fa(state.stats?.convertedLeads ?? 0)} /></div>}
    filtered={state.leads.filter((item) => (!status || item.status === status) && (!source || item.source === source))}
    filters={[{ label: "وضعیت", options: leadStatuses, value: status, onChange: setStatus }, { label: "منبع جذب", options: sources, value: source, onChange: setSource }]}
    searchBy={(item) => [item.name, item.mobile, item.email, item.owner].join(" ")}
    columns={({ show }) => [
      { accessorKey: "name", header: "نام سرنخ", cell: ({ row }) => <button className="table-person" onClick={() => show(row.original)}><PersonAvatar name={row.original.name} /><b>{row.original.name}</b></button> },
      { accessorKey: "source", header: "منبع جذب" },
      { accessorKey: "status", header: "وضعیت", cell: ({ row }) => <Badge tone={leadTone[leadStatuses.indexOf(row.original.status)]}>{row.original.status}</Badge> },
      { accessorKey: "score", header: "امتیاز", cell: ({ row }) => <div className="row"><progress max={100} value={row.original.score} aria-label="امتیاز سرنخ" />{fa(row.original.score)}</div> },
      { accessorKey: "owner", header: "کارشناس" }, { accessorKey: "followUp", header: "آخرین پیگیری", cell: ({ row }) => shortDate(row.original.followUp) },
    ]}
    fields={[
      { key: "name", label: "نام سرنخ", required: true }, { key: "mobile", label: "شماره موبایل", kind: "mobile", required: true },
      { key: "email", label: "ایمیل", kind: "email" }, { key: "companyId", label: "شرکت", kind: "select", options: choices(state.companies) },
      { key: "source", label: "منبع جذب", kind: "select", options: sources }, { key: "status", label: "وضعیت", kind: "select", options: leadStatuses.filter((value) => value !== "تبدیل‌شده"), required: true },
      { key: "score", label: "امتیاز", kind: "number", max: 100, required: true }, { key: "owner", label: "کارشناس", kind: "select", options: ownerChoices(state.settings.users) },
      { key: "followUp", label: "آخرین پیگیری", kind: "date" }, { key: "description", label: "توضیحات", kind: "textarea" },
    ]}
    defaults={(item) => item ? { ...item, owner: item.ownerId, status: item.status === "تبدیل‌شده" ? "واجد شرایط" : item.status } : { status: "جدید", score: 0, owner: state.settings.membershipId }}
    save={(values, item) => {
      const { name, mobile, email, companyId, source, owner, followUp, description } = values;
      const record: Lead = { id: item?.id || id(), name, mobile, email, companyId, source, owner, followUp, description, status: item?.status === "تبدیل‌شده" ? item.status : values.status as LeadStatus, score: Number(values.score), created: item?.created || new Date().toISOString() };
      return crm.save("leads", record);
    }}
    remove={(ids) => crm.remove("leads", ids)}
    rowExtras={(item) => item.status !== "تبدیل‌شده" && <MenuItem onSelect={() => convert(item)}><UserRoundPlus /> تبدیل به مشتری</MenuItem>}
    details={(item, actions) => <div className="stack"><div className="row"><Badge tone={leadTone[leadStatuses.indexOf(item.status)]}>{item.status}</Badge><Button variant="outline" onClick={() => actions.edit(item)}><Pencil />ویرایش</Button>{item.status !== "تبدیل‌شده" && <Button onClick={() => convert(item)}>تبدیل به مشتری<ArrowLeft /></Button>}</div>
      <Details rows={[["شماره موبایل", <bdi dir="ltr" key="mobile">{item.mobile}</bdi>], ["ایمیل", <bdi dir="ltr" key="email">{item.email || "—"}</bdi>], ["منبع جذب", item.source], ["کارشناس", item.owner], ["امتیاز", fa(item.score)], ["آخرین پیگیری", shortDate(item.followUp)]]} />{item.description && <p>{item.description}</p>}</div>}
  />;
}
