"use client";

import { useState } from "react";
import { Activity as ActivityIcon, Pencil } from "lucide-react";
import { type Activity, activityTypes } from "@shared/model";
import { crm, useCRM } from "@/lib/repository";
import { humanDate, id } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { choices, ownerChoices } from "@/components/record-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { IconTile } from "@/components/common";
import { activityIcons } from "./icons";

export default function Activities() {
  const state = useCRM();
  const [type, setType] = useState("");
  if (!state) return null;
  const contact = (key?: string) => state.contacts.find((item) => item.id === key)?.name || "";
  return <RecordPage title="فعالیت‌ها" singular="فعالیت" description="تماس‌ها، جلسه‌ها و دیگر تعاملات با مشتریان را دنبال کنید."
    list={state.activities} filtered={[...state.activities].filter((item) => !type || item.type === type).sort((a, b) => b.date.localeCompare(a.date))}
    filters={[{ label: "نوع فعالیت", options: activityTypes, value: type, onChange: setType }]}
    searchBy={(item) => [item.name, item.description, contact(item.contactId), item.owner].join(" ")}
    columns={({ show }) => [
      { accessorKey: "name", header: "عنوان", cell: ({ row }) => <button className="table-person" onClick={() => show(row.original)}><IconTile icon={activityIcons[row.original.type].icon} tone={activityIcons[row.original.type].tone} /><span><b>{row.original.name}</b><small>{row.original.description}</small></span></button> },
      { accessorKey: "type", header: "نوع", cell: ({ row }) => <Badge tone={activityIcons[row.original.type].tone}>{row.original.type}</Badge> },
      { id: "contact", accessorFn: (item) => contact(item.contactId), header: "مشتری", cell: ({ getValue }) => String(getValue() || "—") },
      { accessorKey: "owner", header: "کارشناس" }, { accessorKey: "date", header: "زمان ثبت", cell: ({ row }) => humanDate(row.original.date, "d MMMM، HH:mm") },
    ]}
    fields={[
      { key: "name", label: "عنوان", required: true, wide: true }, { key: "type", label: "نوع فعالیت", kind: "select", options: activityTypes, required: true },
      { key: "owner", label: "کارشناس", kind: "select", options: ownerChoices(state.settings.users), required: true }, { key: "contactId", label: "مشتری", kind: "select", options: choices(state.contacts) },
      { key: "companyId", label: "شرکت", kind: "select", options: choices(state.companies) }, { key: "description", label: "جزئیات تعامل", kind: "textarea" },
    ]}
    defaults={(item) => item ? { ...item, owner: item.ownerId } : { type: "تماس", owner: state.settings.membershipId }}
    save={(values, item) => crm.save("activities", { id: item?.id || id(), name: values.name, type: values.type as Activity["type"], owner: values.owner, contactId: values.contactId, companyId: values.companyId || state.contacts.find((person) => person.id === values.contactId)?.companyId, description: values.description, date: item?.date || new Date().toISOString() })}
    remove={(ids) => crm.remove("activities", ids)}
    details={(item, actions) => <div className="stack"><div className="spread"><IconTile icon={ActivityIcon} /><Button variant="outline" onClick={() => actions.edit(item)}><Pencil />ویرایش</Button></div>
      <Details rows={[["نوع", item.type], ["کارشناس", item.owner], ["مشتری", contact(item.contactId)], ["شرکت", state.companies.find((company) => company.id === item.companyId)?.name], ["زمان", humanDate(item.date, "d MMMM yyyy، HH:mm")]]} />{item.description && <p>{item.description}</p>}</div>}
  />;
}
