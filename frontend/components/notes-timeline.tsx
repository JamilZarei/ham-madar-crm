"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";
import { activityIcons } from "@/features/activities/icons";
import { type Activity, type Note } from "@shared/model";
import { humanDate } from "@shared/utils";
import { Empty, IconTile } from "./common";
import { Button } from "./ui/button";
import { Textarea } from "./ui/primitives";

export function Notes({ notes, onAdd }: { notes: Note[]; onAdd: (text: string) => void | Promise<unknown> }) {
  const [text, setText] = useState("");
  return <div className="stack">
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault();
      if (!text.trim()) return;
      try { await onAdd(text.trim()); setText(""); toast.success("یادداشت ثبت شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "ثبت یادداشت انجام نشد."); }
    }}><Textarea placeholder="متن یادداشت…" aria-label="متن یادداشت" maxLength={1500} value={text} onChange={(event) => setText(event.target.value)} /><Button type="submit" variant="outline" className="justify-self-start" disabled={!text.trim()}><MessageSquarePlus />ثبت یادداشت</Button></form>
    {notes.map((note) => <article key={note.id} className="note"><time>{humanDate(note.date)}</time><p>{note.text}</p></article>)}
    {!notes.length && <Empty title="یادداشتی ثبت نشده است" />}
  </div>;
}
export function Timeline({ activities, onSelect }: { activities: Activity[]; onSelect?: (item: Activity) => void }) {
  const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) return <Empty title="فعالیتی ثبت نشده است" />;
  return <ol className="timeline">{sorted.map((activity) => {
    const meta = activityIcons[activity.type];
    return <li key={activity.id}><IconTile icon={meta.icon} tone={meta.tone} /><div>
      {onSelect ? <button className="record-link" onClick={() => onSelect(activity)}>{activity.name}</button> : <b>{activity.name}</b>}
      <p>{activity.description}</p><small>{activity.owner} · {humanDate(activity.date, "d MMMM، HH:mm")}</small>
    </div></li>;
  })}</ol>;
}
