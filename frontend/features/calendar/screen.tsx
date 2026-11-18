"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addMonths } from "date-fns-jalali";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Confirm, Modal } from "@/components/ui/primitives";
import { Empty, PageHeading } from "@/components/common";
import { choices, RecordForm } from "@/components/record-form";
import { monthCells, weekdays, weekStart } from "@/components/calendar-picker";
import { type CalendarEvent, type Task, type EventType, eventTypes } from "@shared/model";
import { crm, useCRM, useResource } from "@/lib/repository";
import { faDigits, humanDate, id, isoDay, today } from "@shared/utils";

const eventTone: Record<EventType, string> = { "جلسه": "indigo", "تماس": "green", "وظیفه": "amber" };
export default function Calendar() {
  const state = useCRM();
  const router = useRouter();
  const [anchor, setAnchor] = useState(() => today());
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedDay, setSelectedDay] = useState(() => isoDay());
  const [editor, setEditor] = useState<CalendarEvent | "new">();
  const [confirm, setConfirm] = useState(false);
  const first = weekStart(anchor);
  const days = view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(first, index)) : monthCells(anchor);
  const ranged = useResource<{ tasks: Task[]; events: CalendarEvent[] }>(state ? "/api/crm/calendar/?from=" + isoDay(days[0]) + "&to=" + isoDay(days.at(-1)) : null);
  if (!state) return null;
  const month = humanDate(anchor, "MMMM yyyy");
  const eventsOf = (date: string) => (ranged.data?.events ?? state.events).filter((item) => item.date === date).sort((a, b) => a.time.localeCompare(b.time));
  const tasksOf = (date: string) => (ranged.data?.tasks ?? state.tasks).filter((task) => task.due === date);
  const selectedEvents = eventsOf(selectedDay);
  const selectedTasks = tasksOf(selectedDay);
  const existing = editor !== "new" ? editor : undefined;
  function shift(amount: number) { setAnchor((date) => view === "month" ? addMonths(date, amount) : addDays(date, amount * 7)); }
  return <>
    <PageHeading title="تقویم" description="جلسه‌ها، تماس‌ها و تاریخ سررسید وظایف را یک‌جا ببینید." actions={<Button onClick={() => setEditor("new")}><Plus />افزودن رویداد</Button>} />
    {ranged.error && <p className="field-error" role="alert">{ranged.error}</p>}<div className="calendar-layout"><Card className="calendar-card">
      <header className="calendar-toolbar"><div className="row"><CalendarDays size={17} className="muted" /><h2>{view === "month" ? month : humanDate(days[0], "d MMMM") + " تا " + humanDate(days[6])}</h2></div>
        <div className="row"><div className="segmented"><Button size="sm" variant={view === "month" ? "soft" : "ghost"} aria-pressed={view === "month"} onClick={() => setView("month")}>ماهانه</Button><Button size="sm" variant={view === "week" ? "soft" : "ghost"} aria-pressed={view === "week"} onClick={() => setView("week")}>هفتگی</Button></div>
        <Button onClick={() => { setAnchor(today()); setSelectedDay(isoDay()); }} size="sm" variant="outline">امروز</Button><Button onClick={() => shift(-1)} size="icon" variant="ghost" aria-label="بازهٔ قبل"><ChevronRight /></Button><Button onClick={() => shift(1)} size="icon" variant="ghost" aria-label="بازهٔ بعد"><ChevronLeft /></Button></div>
      </header>
      <div className="calendar-scroll"><div className={"calendar-grid " + (view === "week" ? "weekly" : "")}>
        {weekdays.map((weekday) => <div className="calendar-weekday" key={weekday}>{weekday}</div>)}
        {days.map((day) => {
          const date = isoDay(day);
          const appointments = eventsOf(date);
          const tasks = tasksOf(date);
          return <div className={"calendar-cell" + (humanDate(day, "MMMM yyyy") !== month ? " other-day" : "") + (selectedDay === date ? " selected-day" : "")} key={date}>
            <button className="calendar-day" type="button" aria-label={humanDate(day)} aria-pressed={selectedDay === date} onClick={() => setSelectedDay(date)}><span data-today={date === isoDay() || undefined}>{humanDate(day, "d")}</span></button>
            {appointments.map((item) => <button key={item.id} className={"calendar-chip tone-" + eventTone[item.type]} onClick={() => { setSelectedDay(date); setEditor(item); }} title={item.name}>{item.time && faDigits(item.time) + " · "}{item.name}</button>)}
            {tasks.map((item) => <button key={item.id} className="calendar-chip tone-amber" onClick={() => router.push("/tasks/?id=" + item.id)} title={item.name}>{item.name}</button>)}
          </div>;
        })}
      </div></div>
    </Card>
    <Card className="calendar-agenda"><h2>{humanDate(new Date(selectedDay + "T12:00:00"), "EEEE، d MMMM")}</h2>
      <Button variant="outline" size="sm" onClick={() => setEditor("new")}><Plus />رویداد در این روز</Button>
      {selectedEvents.map((item) => <button className="related-row" key={item.id} onClick={() => setEditor(item)}><b>{item.name}</b><Badge tone={eventTone[item.type]}>{item.type}</Badge>{item.time && <span dir="ltr">{faDigits(item.time)}</span>}</button>)}
      {selectedTasks.map((item) => <button className="related-row" key={item.id} onClick={() => router.push("/tasks/?id=" + item.id)}><b>{item.name}</b><Badge tone="amber">وظیفه</Badge></button>)}
      {!selectedEvents.length && !selectedTasks.length && <Empty title="برنامه‌ای برای این روز نیست" icon={CalendarDays} />}
    </Card></div>
    <Modal open={!!editor} onOpenChange={(open) => { if (!open) setEditor(undefined); }} title={existing ? "ویرایش رویداد" : "افزودن رویداد"}>
      <RecordForm key={existing?.id || selectedDay} fields={[
        { key: "name", label: "عنوان", required: true, wide: true }, { key: "type", label: "نوع رویداد", required: true, kind: "select", options: eventTypes },
        { key: "contactId", label: "مشتری مرتبط", kind: "select", options: choices(state.contacts) }, { key: "date", label: "تاریخ", required: true, kind: "date" },
        { key: "time", label: "ساعت", kind: "time" }, { key: "description", label: "توضیحات", kind: "textarea" },
      ]} initial={existing ? { ...existing } : { date: selectedDay, type: "جلسه" }} onCancel={() => setEditor(undefined)}
        extra={existing && <Button type="button" size="sm" variant="ghost" className="danger-text mt-4" onClick={() => setConfirm(true)}>حذف رویداد</Button>}
        onSave={async (values) => {
          const { name, date, time, contactId, description } = values;
          await crm.save("events", { id: existing?.id || id(), name, date, time, contactId, description, type: values.type as EventType });
          setSelectedDay(date); setAnchor(new Date(date + "T12:00:00")); setEditor(undefined); toast.success("رویداد ذخیره شد.");
        }} />
    </Modal>
    <Confirm open={confirm} close={() => setConfirm(false)} title="حذف رویداد" description="این رویداد از تقویم حذف شود؟" onConfirm={async () => { if (existing) { try { await crm.remove("events", [existing.id]); setEditor(undefined); toast.success("رویداد حذف شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "حذف انجام نشد."); } } }} />
  </>;
}
