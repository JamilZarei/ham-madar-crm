"use client";

import { useState } from "react";
import { CircleCheck, Pencil, Tag, UserRoundPlus, UsersRound, UserRoundX } from "lucide-react";
import { type CRMState, type Contact, type ContactStatus, contactStatuses, contactTone, sources, tones } from "@shared/model";
import { crm, useCRM } from "@/lib/repository";
import { fa, id, shortDate } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { Notes, Timeline } from "@/components/notes-timeline";
import { Button } from "@/components/ui/button";
import { Badge, PersonAvatar, Tabs } from "@/components/ui/primitives";
import { choices, ownerChoices } from "@/components/record-form";
import { Stat } from "@/components/common";

export default function Contacts() {
  const state = useCRM();
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  if (!state) return null;
  const company = (key: string) => state.companies.find((item) => item.id === key)?.name || "";
  const stats = <div className="stat-grid record-stats">
    <Stat label="کل مشتریان" value={fa(state.stats?.contacts ?? state.contacts.length)} icon={UsersRound} />
    <Stat label="مشتریان فعال" value={fa(state.stats?.activeContacts ?? 0)} icon={CircleCheck} tone="green" />
    <Stat label="در مذاکره" value={fa(state.stats?.negotiations ?? 0)} icon={UserRoundPlus} tone="violet" />
    <Stat label="مشتریان غیرفعال" value={fa(state.stats?.inactiveContacts ?? 0)} icon={UserRoundX} tone="amber" />
  </div>;
  return <RecordPage title="مشتریان" description="اطلاعات مشتریان و سابقهٔ ارتباط با آن‌ها را مدیریت کنید." singular="مشتری" list={state.contacts}
    filtered={state.contacts.filter((contact) => (!status || contact.status === status) && (!source || contact.source === source))}
    filters={[{ value: status, onChange: setStatus, label: "وضعیت", options: contactStatuses }, { value: source, onChange: setSource, label: "منبع جذب", options: sources }]} allowBatch summary={stats}
    searchBy={(item) => [item.name, item.mobile, item.email, (item.companyName ?? company(item.companyId)), ...item.tags].join(" ")}
    columns={({ show }) => [
      { accessorKey: "name", header: "نام و نام خانوادگی", cell: ({ row: { original: item }, row }) => <button className="table-person" onClick={() => show(item)}><PersonAvatar name={item.name} tone={tones[row.index % tones.length]} /><span><b>{item.name}</b><small>{item.role || "مشتری"}</small></span></button> },
      { id: "company", accessorFn: (item) => (item.companyName ?? company(item.companyId)), header: "شرکت", cell: ({ getValue }) => String(getValue() || "—") },
      { accessorKey: "mobile", header: "شماره موبایل", cell: ({ row }) => <bdi dir="ltr">{row.original.mobile}</bdi> },
      { accessorKey: "email", header: "ایمیل", cell: ({ row }) => <bdi dir="ltr">{row.original.email || "—"}</bdi> },
      { accessorKey: "status", header: "وضعیت", cell: ({ row }) => <Badge tone={contactTone[row.original.status]}>{row.original.status}</Badge> },
      { accessorKey: "owner", header: "کارشناس" },
      { accessorKey: "created", header: "تاریخ ثبت", cell: ({ row }) => shortDate(row.original.created) },
    ]}
    fields={[
      { key: "name", label: "نام و نام خانوادگی", required: true }, { key: "mobile", label: "شماره موبایل", kind: "mobile", required: true },
      { key: "email", label: "ایمیل", kind: "email" }, { key: "companyId", label: "شرکت", kind: "select", options: choices(state.companies) },
      { key: "role", label: "سمت" }, { key: "status", label: "وضعیت", kind: "select", required: true, options: contactStatuses },
      { key: "source", label: "منبع جذب", kind: "select", options: sources }, { key: "owner", label: "کارشناس", kind: "select", options: ownerChoices(state.settings.users) },
      { key: "tags", label: "برچسب‌ها", placeholder: "با ویرگول جدا کنید", wide: true }, { key: "description", label: "توضیحات", kind: "textarea" },
    ]}
    defaults={(item) => item ? { ...item, owner: item.ownerId, tags: item.tags.join("، ") } : { status: "فعال", owner: state.settings.membershipId }}
    save={(values, item) => {
      const { name, mobile, email, companyId, role, source, description, owner } = values;
      if (state.contacts.some((contact) => contact.mobile === mobile && contact.id !== item?.id)) throw new Error("مشتری با این شماره از قبل ثبت شده است.");
      const record: Contact = { id: item?.id || id(), name, mobile, email, companyId, role, source, description, owner, status: values.status as ContactStatus,
        tags: [...new Set(values.tags.split(/[،,]/).map((tag) => tag.trim()).filter(Boolean))], notes: item?.notes ?? [], created: item?.created || new Date().toISOString() };
      return crm.save("contacts", record);
    }}
    remove={(ids) => crm.remove("contacts", ids)}
    details={(item, actions) => <ContactDetails item={item} state={state} company={(item.companyName ?? company(item.companyId))} edit={() => actions.edit(item)} />}
  />;
}
function ContactDetails({ item, state, company, edit }: { item: Contact; state: CRMState; company: string; edit: () => void }) {
  return <div className="stack"><div className="spread detail-person"><div className="row"><PersonAvatar name={item.name} /><div><h3>{item.name}</h3><p className="muted">{[item.role, company].filter(Boolean).join(" · ")}</p></div></div><Button variant="outline" onClick={edit}><Pencil /> ویرایش</Button></div>
    <Tabs.Root defaultValue="info"><Tabs.List className="tab-list" aria-label="بخش‌های مشتری"><Tabs.Trigger value="info">اطلاعات</Tabs.Trigger><Tabs.Trigger value="activity">ارتباطات</Tabs.Trigger><Tabs.Trigger value="notes">یادداشت‌ها</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="info" className="stack">
        <Details rows={[["وضعیت", <Badge tone={contactTone[item.status]} key="status">{item.status}</Badge>], ["شماره موبایل", <bdi dir="ltr" key="mobile">{item.mobile}</bdi>], ["ایمیل", <bdi dir="ltr" key="email">{item.email || "—"}</bdi>], ["شرکت", company], ["کارشناس", item.owner], ["منبع جذب", item.source], ["تاریخ ثبت", shortDate(item.created)]]} />
        {item.tags.length > 0 && <div className="row"><Tag size={15} />{item.tags.map((tag) => <Badge key={tag} tone="indigo">{tag}</Badge>)}</div>}{item.description && <p>{item.description}</p>}
      </Tabs.Content><Tabs.Content value="activity"><Timeline activities={state.activities.filter((activity) => activity.contactId === item.id)} /></Tabs.Content>
      <Tabs.Content value="notes"><Notes notes={item.notes} onAdd={(text) => crm.appendNote("contacts", item.id, text)} /></Tabs.Content>
    </Tabs.Root>
  </div>;
}
