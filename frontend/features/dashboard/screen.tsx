"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, CalendarDays, ChartNoAxesCombined, CheckSquare2, ChevronDown, CircleHelp, Clock3, Funnel, Plus, Target, UsersRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, CheckBox, Hint, Menu, MenuItem, PersonAvatar } from "@/components/ui/primitives";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, IconTile, PageHeading, PanelHeading, Stat, TextLink } from "@/components/common";
import { crm, useCRM } from "@/lib/repository";
import { contactTone, priorityTone, tones } from "@shared/model";
import { fa, humanDate, isoDay, shortDate, time } from "@shared/utils";
import { activityIcons } from "@/features/activities/icons";
import { SalesChart } from "./charts";
import { dashboardData } from "./analytics";

const ranges = [7, 30, 60];
export default function Dashboard() {
  const state = useCRM();
  const [days, setDays] = useState(30);
  if (!state) return null;
  const { income, change, activeDeals, conversion, newContacts, tasksToday, points, funnel } = dashboardData(state, days);
  const upcoming = state.tasks.filter((task) => task.status !== "انجام‌شده").sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  const recent = [...state.contacts].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 4);
  const activities = [...state.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return <div className="dashboard">
    <PageHeading title={"سلام، " + state.settings.name.split(" ")[0] + "!"} eyebrow={<><CalendarDays size={13} />{humanDate(new Date(), "EEEE، d MMMM yyyy")}</>} description="وضعیت فروش و پیگیری‌های تیمتان را یک‌جا ببینید."
      actions={<>
        <Menu trigger={<Button variant="outline"><CalendarDays />{fa(days)} روز گذشته<ChevronDown size={14} /></Button>}>{ranges.map((range) => <MenuItem key={range} onSelect={() => setDays(range)}>{fa(range)} روز گذشته</MenuItem>)}</Menu>
        <Menu trigger={<Button><Plus />افزودن سریع<ChevronDown size={14} /></Button>}>
          <MenuItem asChild><Link href="/contacts/?new=1">مشتری جدید</Link></MenuItem><MenuItem asChild><Link href="/leads/?new=1">سرنخ جدید</Link></MenuItem>
          <MenuItem asChild><Link href="/deals/?new=1">فرصت فروش جدید</Link></MenuItem><MenuItem asChild><Link href="/tasks/?new=1">وظیفهٔ جدید</Link></MenuItem>
        </Menu>
      </>} />
    <div className="stat-grid">
      <Stat label="درآمد کل" icon={Wallet} value={<>{fa(Math.round(income / 1_000_000))}<small>میلیون تومان</small></>} foot={change === null ? <span>فروش در بازهٔ انتخابی</span> : <><span className={"trend " + (change < 0 ? "trend-down" : "")}>{change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{fa(Math.abs(Math.round(change)))}٪</span><span>نسبت به بازهٔ قبل</span></>} />
      <Stat label="فرصت‌های فعال" icon={Target} tone="cyan" value={fa(state.stats?.activeDeals ?? activeDeals.length)} foot={<><span className="metric-mark tone-cyan"><i className="dot" /></span><span>در جریان قیف فروش</span></>} />
      <Stat label="کل مشتریان" icon={UsersRound} tone="violet" value={fa(state.stats?.contacts ?? state.contacts.length)} foot={<><span className="trend"><ArrowUpRight size={12} />{fa(newContacts)} جدید</span><span>در بازهٔ انتخابی</span></>} />
      <Stat label="نرخ تبدیل سرنخ" icon={Funnel} tone="green" value={fa(conversion) + "٪"} foot={<><span className="metric-mark tone-green"><i className="dot" /></span><span>از سرنخ به مشتری</span></>} />
    </div>
    <div className="dashboard-charts">
      <Card><PanelHeading title="روند فروش" description="درآمد در بازهٔ انتخابی، به میلیون تومان" icon={ChartNoAxesCombined} action={<Button asChild variant="outline" size="sm"><Link href="/reports/">گزارش فروش<ArrowLeft size={14} /></Link></Button>} />
        <CardContent><SalesChart points={points} />
          <div className="chart-legend"><span><i />فروش این بازه</span><span><i className="dash" />فروش بازهٔ قبل</span></div>
        </CardContent>
      </Card>
      <Card><PanelHeading title="قیف فروش" description="توزیع فرصت‌ها در مراحل فروش" icon={Funnel} action={<Hint label="معامله‌های ناموفق در قیف نمایش داده نمی‌شوند"><Button variant="ghost" size="icon" aria-label="راهنمای قیف فروش"><CircleHelp /></Button></Hint>} />
        <CardContent className="funnel-body">
          <div className="funnel" aria-label="مراحل قیف فروش">{funnel.map(({ stage, count }, index) => <Link aria-label={stage + "، " + fa(count) + " فرصت"} href={"/deals/?stage=" + encodeURIComponent(stage)} key={stage} className={"funnel-step funnel-" + index} style={{ width: 100 - index * 11 + "%" }}><span>{stage}</span><b>{fa(count)}</b></Link>)}</div>
          <div className="funnel-summary"><div><b>{fa(Math.round(Number(state.stats?.openToman ?? 0) / 1_000_000))}</b><small>ارزش قیف · میلیون تومان</small></div><div><b>{fa(state.stats?.wonDeals ?? 0)}</b><small>معاملهٔ موفق</small></div></div>
        </CardContent>
      </Card>
    </div>
    <div className="dashboard-lists">
      <Card className="list-panel"><PanelHeading title="فعالیت‌های اخیر" description="آخرین تعاملات ثبت‌شده" icon={Activity} />
        <div className="dashboard-rows">{activities.map((item) => { const meta = activityIcons[item.type]; return <Link href={"/activities/?id=" + item.id} className="dashboard-row" key={item.id}><IconTile icon={meta.icon} tone={meta.tone} /><span className="line-text"><b>{item.name}</b><small>{item.description}</small></span><time className="muted text-[10px]">{time(item.date)}</time></Link>; })}
          {!activities.length && <Empty title="هنوز فعالیتی ثبت نشده" />}</div>
        <div className="list-footer"><TextLink href="/activities/">همهٔ فعالیت‌ها</TextLink></div>
      </Card>
      <Card className="list-panel"><PanelHeading title="آخرین مشتریان" description="مشتریانی که تازه ثبت شده‌اند" icon={UsersRound} />
        <div className="dashboard-rows">{recent.map((contact, index) => <Link href={"/contacts/?id=" + contact.id} className="dashboard-row" key={contact.id}><PersonAvatar name={contact.name} tone={tones[index % tones.length]} /><span className="line-text"><b>{contact.name}</b><small>{state.companies.find((company) => company.id === contact.companyId)?.name || contact.role || "مشتری"}</small></span><Badge tone={contactTone[contact.status]}>{contact.status}</Badge></Link>)}
          {!recent.length && <Empty title="هنوز مشتری ثبت نشده" />}</div>
        <div className="list-footer"><TextLink href="/contacts/">همهٔ مشتریان</TextLink></div>
      </Card>
      <Card className="list-panel"><PanelHeading title="وظایف پیش رو" description={fa(tasksToday) + " وظیفهٔ باز برای امروز"} icon={CheckSquare2} />
        <div className="dashboard-rows">{upcoming.map((task) => <div className="dashboard-row" key={task.id}>
          <CheckBox label={"انجام شد: " + task.name} checked={task.status === "انجام‌شده"} onCheckedChange={async () => { try { await crm.save("tasks", { ...task, status: "انجام‌شده" }); } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد."); } }} />
          <Link href={"/tasks/?id=" + task.id} className="line-text"><b>{task.name}</b><small>{task.owner}</small></Link>
          <Badge tone={task.due <= isoDay() ? priorityTone[task.priority] : "neutral"}>{task.due === isoDay() ? "امروز" : shortDate(task.due)}</Badge>
        </div>)}{!upcoming.length && <Empty title="وظیفهٔ بازی وجود ندارد" icon={Clock3} />}</div>
        <div className="list-footer"><TextLink href="/tasks/">همهٔ وظایف</TextLink></div>
      </Card>
    </div>
  </div>;
}
