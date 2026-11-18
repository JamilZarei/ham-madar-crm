"use client";

import { useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ArrowLeftRight, GripVertical, Search } from "lucide-react";
import { type Deal, type Stage, stages, stageTone } from "@shared/model";
import { cn, fa, money, searchText, shortDate } from "@shared/utils";
import { Button } from "@/components/ui/button";
import { Badge, Input, MenuItem, PersonAvatar } from "@/components/ui/primitives";
import { RecordMenu } from "@/components/record-tools";
import { type RecordActions } from "@/components/record-page";

function DealCard({ item, company, actions, move }: { item: Deal; company: string; actions: RecordActions<Deal>; move: (deal: Deal, stage: Stage) => void }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: item.id });
  return <article className={cn("deal-card", isDragging && "is-dragging")} ref={setNodeRef}>
    <div className="spread"><button className="record-link" onClick={() => actions.show(item)}>{item.name}</button><Button className="drag-handle" type="button" variant="ghost" size="icon" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={"جابه‌جایی " + item.name} aria-roledescription="دستهٔ جابه‌جایی"><GripVertical size={14} /></Button></div>
    <p className="muted text-xs">{company || "شرکت ثبت نشده"}</p><strong className="deal-value">{money(item.amountToman ?? item.value)}</strong>
    <div className="row muted text-[10px]"><progress max={100} value={item.probability} aria-label="احتمال موفقیت" />{fa(item.probability)}٪</div>
    <div className="deal-card-foot"><PersonAvatar name={item.owner} /><span>{shortDate(item.close)}</span><RecordMenu detail={() => actions.show(item)} edit={() => actions.edit(item)} remove={() => actions.remove(item)}>
      {stages.filter((stage) => item.stage !== stage).map((stage) => <MenuItem key={stage} onSelect={() => move(item, stage)}><ArrowLeftRight /> انتقال به {stage}</MenuItem>)}
    </RecordMenu></div>
  </article>;
}
function StageColumn({ stage, rows, company, actions, move }: { stage: Stage; rows: Deal[]; company: (id: string) => string; actions: RecordActions<Deal>; move: (deal: Deal, stage: Stage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return <section aria-label={"مرحله " + stage} ref={setNodeRef} className={cn("kanban-column", isOver && "over")}>
    <div className="kanban-column-head"><Badge tone={stageTone[stage]}>{stage}</Badge><b>{fa(rows.length)}</b></div>
    <div className="kanban-total">{money(rows.reduce((total, item) => total + BigInt(item.amountToman ?? item.value), BigInt(0)).toString())}</div>
    <div className="kanban-cards">{rows.map((item) => <DealCard item={item} company={(item.companyName ?? company(item.companyId))} actions={actions} move={move} key={item.id} />)}{!rows.length && <p className="kanban-empty">فرصتی در این مرحله نیست.</p>}</div>
  </section>;
}
export function DealsBoard({ rows, company, actions, move }: { rows: Deal[]; company: (id: string) => string; actions: RecordActions<Deal>; move: (deal: Deal, stage: Stage) => void }) {
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));
  const visible = rows.filter((item) => searchText(item.name + " " + (item.companyName ?? company(item.companyId)) + " " + item.owner).includes(searchText(query)));
  const activeDeal = rows.find((item) => item.id === dragging);
  function finish(event: DragEndEvent) {
    setDragging(null);
    const stage = stages.find((item) => item === event.over?.id);
    const deal = rows.find((item) => item.id === event.active.id);
    if (stage && deal) move(deal, stage);
  }
  return <div className="stack"><div className="table-search kanban-search"><Search size={16} /><Input aria-label="جست‌وجوی فرصت" placeholder="جست‌وجوی فرصت…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(event) => setDragging(String(event.active.id))} onDragCancel={() => setDragging(null)} onDragEnd={finish}
      accessibility={{ screenReaderInstructions: { draggable: "با کلید فاصله جابه‌جایی را شروع کنید. با کلیدهای جهت حرکت کنید و با فاصله رها کنید." },
        announcements: { onDragStart: () => "جابه‌جایی آغاز شد.", onDragOver: ({ over }) => over ? "مرحلهٔ " + over.id : "", onDragEnd: () => "جابه‌جایی پایان یافت.", onDragCancel: () => "جابه‌جایی لغو شد." } }}>
      <div className="kanban-scroll"><div className="kanban">{stages.map((stage) => <StageColumn stage={stage} rows={visible.filter((item) => item.stage === stage)} company={company} actions={actions} move={move} key={stage} />)}</div></div>
      <DragOverlay>{activeDeal && <article className="deal-card drag-preview"><b>{activeDeal.name}</b><p className="muted">{money(activeDeal.amountToman ?? activeDeal.value)}</p></article>}</DragOverlay>
    </DndContext>
  </div>;
}
