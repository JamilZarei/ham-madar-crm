"use client";

import { useRef, useState } from "react";
import { CircleCheck, CircleX, Clock3, Eye, FileText, MessageSquareText, Plus, Send, Wallet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, CheckBox, Confirm, Input, Modal, Select, Tabs, Textarea } from "@/components/ui/primitives";
import { Empty, PageHeading, PanelHeading, Stat } from "@/components/common";
import { DataTable } from "@/components/data-table";
import { RecordForm } from "@/components/record-form";
import { Details, RecordMenu } from "@/components/record-tools";
import { type CRMState, type Contact, type Sms, type Template, smsStatuses, smsTone } from "@shared/model";
import { crm, mutate, useCRM, useResource } from "@/lib/repository";
import { fa, humanDate, id } from "@shared/utils";
import { renderMessage, segmentCount, variables } from "./service";

const colors = ["#25a983", "#ec6e89", "#e7a447"];
const smsTypes = ["اطلاع‌رسانی", "پیگیری", "خوشامدگویی"];
export default function SMS() {
  const state = useCRM();
  const [tab, setTab] = useState("overview");
  if (!state) return null;
  const counts = smsStatuses.map((name, index) => ({ name, value: [state.stats?.smsDelivered ?? 0, state.stats?.smsFailed ?? 0, state.stats?.smsPending ?? 0][index] }));
  return <>
    <PageHeading title="مدیریت پیامک‌ها" description="قالب‌ها و ارسال‌های آزمایشی تیم را مدیریت و پیگیری کنید." actions={<Button onClick={() => setTab("compose")}><Send />ارسال آزمایشی</Button>} />
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="tab-list" aria-label="بخش‌های پیامک"><Tabs.Trigger value="overview">نمای کلی</Tabs.Trigger><Tabs.Trigger value="compose">ارسال پیامک</Tabs.Trigger><Tabs.Trigger value="templates">قالب‌ها</Tabs.Trigger><Tabs.Trigger value="history">تاریخچه</Tabs.Trigger></Tabs.List>
      <Tabs.Content value="overview" className="stack">
        <div className="stat-grid"><Stat label="کل پیامک‌ها" value={fa(state.stats?.sms ?? 0)} icon={MessageSquareText} /><Stat label="موفق" value={fa(counts[0].value)} icon={CircleCheck} tone="green" />
          <Stat label="ناموفق" value={fa(counts[1].value)} icon={CircleX} tone="red" /><Stat label="در انتظار" value={fa(counts[2].value)} icon={Clock3} tone="amber" /></div>
        <div className="two-panels"><Card><PanelHeading title="وضعیت ارسال" description="نتیجهٔ پیامک‌های ثبت‌شده" icon={MessageSquareText} />
          <CardContent><div className="donut-chart" dir="ltr"><ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 360, height: 170 }}><PieChart><Pie data={counts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={73} paddingAngle={3} isAnimationActive={false}>{counts.map((item, index) => <Cell key={item.name} fill={colors[index]} stroke="var(--surface)" />)}</Pie><Tooltip formatter={(value) => fa(Number(value))} contentStyle={{ direction: "rtl", background: "var(--surface)", color: "var(--text)", borderColor: "var(--line)" }} /></PieChart></ResponsiveContainer></div>
          <div className="row justify-center">{counts.map(({ name, value }) => <Badge key={name} tone={smsTone[name]}>{name} · {fa(value)}</Badge>)}</div></CardContent></Card>
          <Card><PanelHeading title="اعتبار پیامکی" description="سهمیهٔ نمایشی فضای کاری" icon={Wallet} /><CardContent className="stack"><div className="stat-number">{fa(state.settings.smsCredit ?? 0)}<small>واحد پیامک باقی‌مانده</small></div><p className="muted">شمارهٔ فرستندهٔ نمونه <bdi dir="ltr">{state.settings.smsSender}</bdi></p><Button variant="outline" className="justify-self-start" onClick={() => setTab("history")}>مشاهدهٔ تاریخچه</Button></CardContent></Card></div>
      </Tabs.Content>
      <Tabs.Content value="compose"><Compose state={state} onSent={() => setTab("history")} /></Tabs.Content>
      <Tabs.Content value="templates"><Templates items={state.templates} /></Tabs.Content>
      <Tabs.Content value="history"><History items={state.sms} /></Tabs.Content>
    </Tabs.Root>
  </>;
}
function Compose({ state, onSent }: { state: CRMState; onSent: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mobile, setMobile] = useState("");
  const [text, setText] = useState("");
  const [type, setType] = useState(smsTypes[0]);
  const [template, setTemplate] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const savedKey = useRef<{ value: string; key: string }>(undefined);
  const first = state.contacts.find((item) => item.id === selected[0]);
  const company = state.companies.find((item) => item.id === first?.companyId)?.name;
  const search = useResource<{ rows: Contact[] }>(query ? "/api/crm/records/contacts/?size=25&search=" + encodeURIComponent(query) : null, 160);
  const shown = query ? search.data?.rows ?? [] : state.contacts;
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const options = { selected, mobile, text, type, templateId: template };
      const value = JSON.stringify(options);
      if (savedKey.current?.value !== value) savedKey.current = { value, key: id() };
      const result = await mutate<{ count: number }>({ operation: "sms", values: { ...options, key: savedKey.current.key } });
      toast.success(fa(result.count) + " پیامک آزمایشی در تاریخچه ثبت شد.");
      onSent();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "ثبت ارسال آزمایشی انجام نشد."); }
    finally { setBusy(false); }
  }
  return <form className="two-panels" onSubmit={send} noValidate>
    <Card><PanelHeading title="پیام جدید" description="متن و گیرندگان ارسال آزمایشی را تعیین کنید." icon={Send} /><CardContent className="stack">
      <label className="field-label">قالب پیامک<Select value={template} onChange={(event) => { setTemplate(event.target.value); const item = state.templates.find((entry) => entry.id === event.target.value); if (item) setText(item.text); }}><option value="">بدون قالب</option>{state.templates.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></label>
      <div className="field-label"><label htmlFor="sms-contact-search">انتخاب مشتریان · {fa(selected.length)} انتخاب</label><Input id="sms-contact-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام یا شمارهٔ مشتری…" />
        <div className="contact-picker">{shown.map((item) => <label className="spread" key={item.id}><span className="row"><CheckBox label={"انتخاب " + item.name} checked={selected.includes(item.id)} onCheckedChange={(checked) => setSelected((values) => checked ? [...values, item.id] : values.filter((value) => value !== item.id))} />{item.name}</span><bdi className="muted" dir="ltr">{item.mobile}</bdi></label>)}{!shown.length && <Empty title="مشتری پیدا نشد" />}</div>
      </div>
      <label className="field-label">شمارهٔ دستی<Input dir="ltr" inputMode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" value={mobile} onChange={(event) => setMobile(event.target.value)} /></label>
      <label className="field-label">نوع پیامک<Select value={type} onChange={(event) => setType(event.target.value)}>{smsTypes.map((item) => <option key={item}>{item}</option>)}</Select></label>
      <label className="field-label">متن پیام<Textarea value={text} maxLength={670} onChange={(event) => setText(event.target.value)} /></label>
      <div className="spread muted text-xs"><span>{fa(text.length)} نویسه از {fa(670)}</span><span>{fa(segmentCount(text))} واحد پیامک تقریبی</span></div>
      {error && <div className="field-error" role="alert">{error}</div>}<Button className="justify-self-start" type="submit" disabled={busy}><Send />{busy ? "در حال ثبت ارسال…" : "ارسال آزمایشی"}</Button>
    </CardContent></Card>
    <Card><PanelHeading title="پیش‌نمایش پیامک" description={first ? "نمونه برای " + first.name : "نمونهٔ متن پس از جایگزینی متغیرها"} icon={Eye} /><CardContent><div className="message-preview">{text.trim() ? renderMessage(text, first, company) : "متن پیامک در اینجا نمایش داده می‌شود."}</div>
      <div className="row mt-4">{variables.map((variable) => <Button type="button" key={variable} dir="ltr" size="sm" variant="outline" onClick={() => setText((current) => (current + (current ? " " : "") + variable).slice(0, 670))}>{variable}</Button>)}</div>
    </CardContent></Card>
  </form>;
}
function Templates({ items }: { items: Template[] }) {
  const [editor, setEditor] = useState<Template | "new">();
  const [preview, setPreview] = useState<Template>();
  const [deleting, setDeleting] = useState<Template>();
  const item = editor === "new" ? undefined : editor;
  return <div className="stack">
    <Button className="justify-self-start" onClick={() => setEditor("new")}><Plus />قالب جدید</Button>
    <div className="two-panels">{items.map((entry) => <Card key={entry.id}><PanelHeading title={entry.name} icon={FileText} action={<RecordMenu detail={() => setPreview(entry)} edit={() => setEditor(entry)} remove={() => setDeleting(entry)} />} /><CardContent><p className="message-preview">{entry.text}</p></CardContent></Card>)}</div>
    {!items.length && <Card><Empty title="قالبی ثبت نشده است" icon={FileText} /></Card>}
    <Modal open={!!editor} onOpenChange={(open) => { if (!open) setEditor(undefined); }} title={item ? "ویرایش قالب" : "قالب پیامک جدید"} description="برای شخصی‌سازی، متغیرهای نام مشتری و شرکت را در متن قرار دهید.">
      <RecordForm key={item?.id || "new"} fields={[{ key: "name", label: "نام قالب", wide: true, required: true }, { key: "text", label: "متن قالب", kind: "textarea", required: true, placeholder: "سلام {{customer_name}}، درخواست شما ثبت شد." }]}
        initial={item ? { ...item } : {}} onCancel={() => setEditor(undefined)} extra={<div className="row mt-3" dir="ltr">{variables.map((variable) => <code key={variable}>{variable}</code>)}</div>}
        onSave={async ({ name, text }) => { if (text.length > 670) throw new Error("متن قالب حداکثر ۶۷۰ نویسه است."); await crm.save("templates", { id: item?.id || id(), name, text }); toast.success("قالب ذخیره شد."); setEditor(undefined); }} />
    </Modal>
    <Modal open={!!preview} onOpenChange={(open) => { if (!open) setPreview(undefined); }} title={preview?.name || "پیش‌نمایش قالب"}>{preview && <div className="message-preview">{renderMessage(preview.text, { name: "مهسا صادقی" }, "رادین‌پرداز")}</div>}</Modal>
    <Confirm open={!!deleting} close={() => setDeleting(undefined)} title="حذف قالب پیامک" description="قالب انتخاب‌شده حذف شود؟" onConfirm={async () => { if (deleting) try { await crm.remove("templates", [deleting.id]); toast.success("قالب حذف شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "حذف انجام نشد."); } }} />
  </div>;
}

function History({ items }: { items: Sms[] }) {
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Sms>();
  return <>
    <DataTable resource="sms" rows={items.filter((item) => (!status || item.status === status) && (!source || item.source === source))} searchBy={(item) => [item.name, item.mobile, item.text].join(" ")}
      filters={[{ label: "وضعیت", options: smsStatuses, value: status, onChange: setStatus }, { label: "منبع", options: ["دستی", "اتوماسیون"], value: source, onChange: setSource }]}
      columns={[
        { accessorKey: "mobile", header: "گیرنده", cell: ({ row }) => <bdi dir="ltr">{row.original.mobile}</bdi> },
        { accessorKey: "name", header: "نام مشتری", cell: ({ row }) => row.original.name || "—" },
        { accessorKey: "text", header: "متن پیام", cell: ({ row }) => <button className="record-link sms-line" onClick={() => setPreview(row.original)}>{row.original.text}</button> },
        { accessorKey: "date", header: "تاریخ ارسال", cell: ({ row }) => humanDate(row.original.date, "d MMMM، HH:mm") },
        { accessorKey: "status", header: "وضعیت", cell: ({ row }) => <Badge tone={smsTone[row.original.status]}>{row.original.status}</Badge> },
        { accessorKey: "type", header: "نوع" }, { accessorKey: "source", header: "منبع" },
      ]} />
    <Modal open={!!preview} onOpenChange={(open) => { if (!open) setPreview(undefined); }} title="جزئیات پیامک">{preview && <><div className="message-preview">{preview.text}</div><Details rows={[["گیرنده", <bdi key="mobile" dir="ltr">{preview.mobile}</bdi>], ["وضعیت", preview.status], ["ارسال", humanDate(preview.date)], ["منبع", preview.source]]} />{preview.status === "ناموفق" && <Button variant="outline" onClick={async () => { try { const result = await mutate<{ status: Sms["status"] }>({ operation: "retrySms", id: preview.id }); setPreview({ ...preview, status: result.status }); toast.success("تلاش مجدد ثبت شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "تلاش مجدد انجام نشد."); } }}>تلاش مجدد</Button>}</>}</Modal>
  </>;
}
