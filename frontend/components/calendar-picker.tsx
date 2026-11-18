"use client";

import { useState } from "react";
import { addDays, addMonths, startOfMonth } from "date-fns-jalali";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "./ui/button";
import { Pop } from "./ui/primitives";
import { asDate, humanDate, isoDay, today } from "@shared/utils";

export const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const weekStart = (date: Date) => addDays(date, -((date.getDay() + 1) % 7));
export function monthCells(date: Date) {
  const month = startOfMonth(date);
  const first = weekStart(month);
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}
export function JalaliDatePicker({ value, onChange, label, invalid }: { value: string; onChange: (value: string) => void; label: string; invalid?: boolean }) {
  const [month, setMonth] = useState(value ? asDate(value) : today());
  const [open, setOpen] = useState(false);
  const title = humanDate(month, "MMMM yyyy");
  function choose(iso: string) { onChange(iso); setOpen(false); }
  return <div className="date-control">
    <Pop open={open} onOpenChange={(next) => { setOpen(next); if (next) setMonth(value ? asDate(value) : today()); }} trigger={<Button type="button" variant="outline" className="date-trigger" aria-label={label + (value ? "، " + humanDate(asDate(value)) : "")} aria-invalid={invalid}><CalendarDays />{value ? humanDate(asDate(value)) : "انتخاب تاریخ"}</Button>}>
      <div className="date-pop">
        <div className="spread"><Button type="button" size="icon" variant="ghost" aria-label="ماه قبل" onClick={() => setMonth(addMonths(month, -1))}><ChevronRight /></Button><b>{title}</b><Button type="button" size="icon" variant="ghost" aria-label="ماه بعد" onClick={() => setMonth(addMonths(month, 1))}><ChevronLeft /></Button></div>
        <div className="date-grid">{weekdays.map((day) => <span key={day} title={day}>{day[0]}</span>)}
          {monthCells(month).map((day) => { const iso = isoDay(day); return <button type="button" key={iso} aria-label={humanDate(day)} aria-pressed={iso === value} className={title === humanDate(day, "MMMM yyyy") ? "" : "other-day"} onClick={() => choose(iso)}>{humanDate(day, "d")}</button>; })}
        </div><button className="text-link mt-2" type="button" onClick={() => choose(isoDay())}>انتخاب امروز</button>
      </div>
    </Pop>
    {value && <Button type="button" size="icon" variant="ghost" aria-label={"پاک کردن " + label} onClick={() => onChange("")}><X /></Button>}
  </div>;
}
