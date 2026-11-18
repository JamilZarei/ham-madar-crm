"use client";

import { useState } from "react";
import { Activity, BarChart3, Funnel, GitBranch, MessageSquareText, Target, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Empty, PageHeading, PanelHeading, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/primitives";
import { JalaliDatePicker } from "@/components/calendar-picker";
import { refreshCRM, useResource } from "@/lib/repository";
import { fa, isoDay, today } from "@shared/utils";
import { SalesChart } from "@/features/dashboard/charts";
import { salesPoints } from "./analytics";
import type { Report } from "@backend/features/reports/report";

export default function Reports() {
  const [from, setFrom] = useState(() => isoDay(today(-29)));
  const [to, setTo] = useState(() => isoDay());
  const invalid = !!from && !!to && from > to;
  const query = new URLSearchParams(); if (from) query.set("from", from); if (to) query.set("to", to);
  const result = useResource<Report>(invalid ? null : "/api/crm/reports/?" + query.toString());
  const data = result.data;
  return <>
    <PageHeading title="گزارش‌ها" description="روند فروش، عملکرد کارشناسان و وضعیت تعاملات را در بازهٔ شمسی بررسی کنید." />
    <Card className="report-filter"><div className="row"><span className="muted">از تاریخ</span><JalaliDatePicker label="ابتدای بازه" value={from} onChange={setFrom} /></div><div className="row"><span className="muted">تا تاریخ</span><JalaliDatePicker label="انتهای بازه" value={to} onChange={setTo} /></div>
      <Button variant="outline" onClick={() => { setFrom(isoDay(today(-29))); setTo(isoDay()); }}>۳۰ روز گذشته</Button>
      {invalid && <span role="alert" className="field-error">تاریخ شروع باید پیش از تاریخ پایان باشد.</span>}
    </Card>
    {result.error && <div className="row"><p role="alert" className="danger-text">{result.error}</p><Button variant="outline" onClick={refreshCRM}>تلاش دوباره</Button></div>}
    {result.loading && !data && <Empty title="در حال بارگیری گزارش…" />}
    {!invalid && data && <>
      <div className="stat-grid record-stats">
        <Stat label="درآمد فروش" icon={Wallet} value={<>{fa(Math.round(Number(data.totalToman) / 1_000_000))}<small>میلیون تومان</small></>} />
        <Stat label="نرخ تبدیل سرنخ" icon={Target} tone="cyan" value={fa(data.conversion) + "٪"} />
        <Stat label="فعالیت‌های مشتریان" icon={Activity} tone="green" value={fa(data.activityCount)} />
        <Stat label="اجراهای اتوماسیون" icon={GitBranch} tone="violet" value={fa(data.runCount)} />
      </div>
      <Tabs.Root defaultValue="sales">
        <Tabs.List aria-label="انواع گزارش" className="tab-list"><Tabs.Trigger value="sales">فروش و کارشناسان</Tabs.Trigger><Tabs.Trigger value="pipeline">قیف و تبدیل</Tabs.Trigger><Tabs.Trigger value="engagement">فعالیت مشتریان</Tabs.Trigger><Tabs.Trigger value="sms">پیامک‌ها</Tabs.Trigger><Tabs.Trigger value="runs">اتوماسیون‌ها</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="sales" className="two-panels">
          <Card><PanelHeading title="روند فروش" description="میلیون تومان در بازهٔ انتخابی" icon={Wallet} /><CardContent>{data.sales.length ? <SalesChart points={salesPoints(data.sales)} comparison={false} /> : <Empty title="فروشی در این بازه نیست" />}</CardContent></Card>
          <Card><PanelHeading title="عملکرد کارشناسان" description="درآمد ثبت‌شده بر حسب میلیون تومان" icon={BarChart3} /><CardContent><ReportBars data={data.byOwner} primary="درآمد" /></CardContent></Card>
        </Tabs.Content>
        <Tabs.Content value="pipeline" className="two-panels">
          <Card><PanelHeading title="وضعیت قیف فروش" icon={Funnel} /><CardContent><ReportBars data={data.funnel} primary="فرصت‌ها" /></CardContent></Card>
          <Card><PanelHeading title="تبدیل سرنخ به تفکیک منبع" icon={Target} /><CardContent><ReportBars data={data.leadSources} primary="سرنخ‌ها" compare="converted" /></CardContent></Card>
        </Tabs.Content>
        <Tabs.Content value="engagement"><Card><PanelHeading title="فعالیت مشتریان" description="تعداد تعاملات به تفکیک نوع" icon={Activity} /><CardContent><ReportBars data={data.touchpoints} primary="فعالیت‌ها" /></CardContent></Card></Tabs.Content>
        <Tabs.Content value="sms"><Card><PanelHeading title="گزارش پیامک‌ها" description="تعداد ارسال‌های آزمایشی به تفکیک وضعیت" icon={MessageSquareText} /><CardContent><ReportBars data={data.smsByStatus} primary="ارسال‌ها" /></CardContent></Card></Tabs.Content>
        <Tabs.Content value="runs"><Card><PanelHeading title="گزارش اجرای اتوماسیون‌ها" description="نتیجهٔ اجراهای ثبت‌شده" icon={GitBranch} /><CardContent><ReportBars data={data.runStatuses} primary="اجراها" /></CardContent></Card></Tabs.Content>
      </Tabs.Root>
    </>}
  </>;
}
function ReportBars({ data, primary, compare }: { data: { name: string; value: number; converted?: number }[]; primary: string; compare?: "converted" }) {
  if (!data.some((item) => item.value)) return <Empty title="داده‌ای برای این بازه وجود ندارد" />;
  return <><div className="report-chart" dir="ltr">
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 430, height: 215 }}><BarChart data={data} margin={{ top: 5, right: 6, left: 5, bottom: 12 }}>
      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" />
      <XAxis dataKey="name" reversed tickLine={false} axisLine={false} tickMargin={7} tick={{ fill: "var(--muted)", fontSize: 10 }} />
      <YAxis orientation="right" width={37} allowDecimals={false} tickLine={false} axisLine={false} tickFormatter={fa} tick={{ fill: "var(--muted)", fontSize: 10 }} />
      <Tooltip formatter={(value) => fa(Number(value))} cursor={{ fill: "var(--soft)" }} contentStyle={{ direction: "rtl", background: "var(--surface)", color: "var(--text)", borderRadius: 8, borderColor: "var(--line)" }} />
      <Bar dataKey="value" name={primary} fill="var(--primary)" maxBarSize={35} radius={[5, 5, 0, 0]} isAnimationActive={false} />
      {compare && <Bar dataKey={compare} name="تبدیل‌شده" fill="#29a582" maxBarSize={35} radius={[5, 5, 0, 0]} isAnimationActive={false} />}
    </BarChart></ResponsiveContainer>
  </div>{compare && <div className="chart-legend"><span><i />{primary}</span><span><i style={{ background: "#29a582" }} />تبدیل‌شده</span></div>}</>;
}
