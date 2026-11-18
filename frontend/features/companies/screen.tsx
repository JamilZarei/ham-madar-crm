"use client";

import Link from "next/link";
import { Building2, Pencil } from "lucide-react";
import { crm, useCRM } from "@/lib/repository";
import { fa, id, money, shortDate } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { Notes, Timeline } from "@/components/notes-timeline";
import { Empty, IconTile } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge, Tabs } from "@/components/ui/primitives";
import { stageTone } from "@shared/model";

export default function Companies() {
  const state = useCRM();
  if (!state) return null;
  return <RecordPage title="شرکت‌ها" singular="شرکت" description="حساب‌های سازمانی، افراد مرتبط و فرصت‌های فروش آن‌ها." list={state.companies}
    searchBy={(item) => [item.name, item.industry, item.mobile, item.email].join(" ")}
    columns={({ show }) => [
      { accessorKey: "name", header: "نام شرکت", cell: ({ row }) => <button className="table-person" onClick={() => show(row.original)}><IconTile icon={Building2} /><b>{row.original.name}</b></button> },
      { accessorKey: "industry", header: "حوزهٔ فعالیت" },
      { accessorKey: "mobile", header: "شماره تماس", cell: ({ row }) => <bdi dir="ltr">{row.original.mobile || "—"}</bdi> },
      { accessorKey: "email", header: "ایمیل", cell: ({ row }) => <bdi dir="ltr">{row.original.email || "—"}</bdi> },
      { id: "people", header: "افراد مرتبط", accessorFn: (item) => item.personCount ?? 0, enableSorting: false, cell: ({ getValue }) => fa(Number(getValue())) },
      { accessorKey: "created", header: "تاریخ ثبت", cell: ({ row }) => shortDate(row.original.created) },
    ]}
    fields={[
      { key: "name", label: "نام شرکت", required: true }, { key: "industry", label: "حوزهٔ فعالیت" }, { key: "mobile", label: "شماره تماس", ltr: true },
      { key: "email", label: "ایمیل", kind: "email" }, { key: "website", label: "وب‌سایت", kind: "url", wide: true }, { key: "description", label: "توضیحات", kind: "textarea" },
    ]}
    defaults={(item) => item ? { name: item.name, industry: item.industry, mobile: item.mobile, email: item.email, website: item.website, description: item.description } : {}}
    save={(values, item) => crm.save("companies", { id: item?.id || id(), name: values.name, industry: values.industry, mobile: values.mobile, email: values.email, website: values.website, description: values.description, notes: item?.notes || [], created: item?.created || new Date().toISOString() })}
    remove={(ids) => crm.remove("companies", ids)}
    details={(item, actions) => {
      const people = state.contacts.filter((contact) => contact.companyId === item.id);
      const deals = state.deals.filter((deal) => deal.companyId === item.id);
      return <div className="stack"><div className="spread detail-person"><div className="row"><IconTile icon={Building2} /><div><h3>{item.name}</h3><p className="muted">{item.industry}</p></div></div><Button variant="outline" onClick={() => actions.edit(item)}><Pencil />ویرایش</Button></div>
        <Tabs.Root defaultValue="info"><Tabs.List className="tab-list" aria-label="بخش‌های شرکت"><Tabs.Trigger value="info">پروفایل</Tabs.Trigger><Tabs.Trigger value="related">افراد و فرصت‌ها</Tabs.Trigger><Tabs.Trigger value="activity">فعالیت‌ها</Tabs.Trigger><Tabs.Trigger value="notes">یادداشت‌ها</Tabs.Trigger></Tabs.List>
          <Tabs.Content value="info"><Details rows={[["تلفن", <bdi dir="ltr" key="mobile">{item.mobile || "—"}</bdi>], ["ایمیل", <bdi dir="ltr" key="email">{item.email || "—"}</bdi>], ["وب‌سایت", item.website && <a dir="ltr" className="text-link" key="site" href={item.website} target="_blank" rel="noreferrer">{item.website}</a>], ["تاریخ ثبت", shortDate(item.created)]]} /><p>{item.description}</p></Tabs.Content>
          <Tabs.Content value="related" className="stack"><h3>افراد مرتبط</h3>{people.length ? people.map((person) => <Link key={person.id} className="related-row" href={"/contacts/?id=" + person.id}><b>{person.name}</b><span>{person.role}</span></Link>) : <Empty title="فرد مرتبطی ثبت نشده" />}
            <h3>فرصت‌های فروش</h3>{deals.length ? deals.map((deal) => <Link key={deal.id} className="related-row" href={"/deals/?id=" + deal.id}><b>{deal.name}</b><Badge tone={stageTone[deal.stage]}>{deal.stage}</Badge><span>{money(deal.amountToman ?? deal.value)}</span></Link>) : <Empty title="فرصتی ثبت نشده" />}</Tabs.Content>
          <Tabs.Content value="activity"><Timeline activities={state.activities.filter((activity) => activity.companyId === item.id)} /></Tabs.Content>
          <Tabs.Content value="notes"><Notes notes={item.notes} onAdd={(text) => crm.appendNote("companies", item.id, text)} /></Tabs.Content>
        </Tabs.Root>
      </div>;
    }} />;
}
