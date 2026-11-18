"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { type Priority, type TaskStatus, priorities, taskStatuses, priorityTone, taskTone } from "@shared/model";
import { crm, useCRM } from "@/lib/repository";
import { faDigits, id, isoDay, shortDate } from "@shared/utils";
import { RecordPage } from "@/components/record-page";
import { Details } from "@/components/record-tools";
import { choices, ownerChoices } from "@/components/record-form";
import { Button } from "@/components/ui/button";
import { Badge, CheckBox, MenuItem } from "@/components/ui/primitives";

export default function Tasks() {
  const state = useCRM();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  if (!state) return null;
  return <RecordPage title="وظایف" singular="وظیفه" description="پیگیری‌های تیم را برنامه‌ریزی کنید و سررسیدها را زیر نظر داشته باشید." list={state.tasks}
    filtered={state.tasks.filter((item) => (!status || item.status === status) && (!priority || item.priority === priority))}
    filters={[{ label: "وضعیت", options: taskStatuses, value: status, onChange: setStatus }, { label: "اولویت", options: priorities, value: priority, onChange: setPriority }]}
    searchBy={(item) => [item.name, item.owner, item.description].join(" ")}
    columns={({ show }) => [
      { id: "done", header: "انجام", enableSorting: false, cell: ({ row }) => <CheckBox checked={row.original.status === "انجام‌شده"} label={"انجام شد: " + row.original.name} onCheckedChange={async (value) => { try { await crm.save("tasks", { ...row.original, status: value ? "انجام‌شده" : "باز" }); } catch (error) { toast.error(error instanceof Error ? error.message : "وضعیت ذخیره نشد."); } }} /> },
      { accessorKey: "name", header: "عنوان وظیفه", cell: ({ row }) => <button className="record-link" onClick={() => show(row.original)}>{row.original.name}</button> },
      { accessorKey: "priority", header: "اولویت", sortingFn: (a, b) => priorities.indexOf(a.original.priority) - priorities.indexOf(b.original.priority), cell: ({ row }) => <Badge tone={priorityTone[row.original.priority]}>{row.original.priority}</Badge> },
      { accessorKey: "status", header: "وضعیت", cell: ({ row }) => <Badge tone={taskTone[row.original.status]}>{row.original.status}</Badge> },
      { accessorKey: "owner", header: "مسئول" },
      { accessorKey: "due", header: "سررسید", cell: ({ row }) => <span className={row.original.due < isoDay() && row.original.status !== "انجام‌شده" ? "danger-text" : ""}>{shortDate(row.original.due)}</span> },
      { accessorKey: "reminder", header: "یادآوری", cell: ({ row }) => row.original.reminder ? <span className="row"><Bell size={13} />{row.original.reminder}</span> : "—" },
    ]}
    fields={[
      { key: "name", label: "عنوان وظیفه", required: true, wide: true }, { key: "owner", label: "مسئول", kind: "select", options: ownerChoices(state.settings.users), required: true },
      { key: "contactId", label: "مشتری مرتبط", kind: "select", options: choices(state.contacts) }, { key: "priority", label: "اولویت", kind: "select", options: priorities, required: true },
      { key: "status", label: "وضعیت", kind: "select", options: taskStatuses, required: true }, { key: "due", label: "سررسید", kind: "date", required: true },
      { key: "dueTime", label: "ساعت سررسید", kind: "time" }, { key: "reminder", label: "یادآوری", kind: "select", options: ["۳۰ دقیقه قبل", "۱ ساعت قبل", "۱ روز قبل"] }, { key: "description", label: "توضیحات", kind: "textarea" },
    ]}
    defaults={(item) => item ? { ...item, owner: item.ownerId } : { priority: "متوسط", status: "باز", due: isoDay(), dueTime: "17:00", owner: state.settings.membershipId }}
    save={(values, item) => {
      const { name, contactId, owner, due, dueTime, reminder, description } = values;
      return crm.save("tasks", { id: item?.id || id(), name, contactId, owner, due, dueTime, reminder, description, priority: values.priority as Priority, status: values.status as TaskStatus, created: item?.created || new Date().toISOString() });
    }}
    remove={(ids) => crm.remove("tasks", ids)}
    rowExtras={(item) => item.status !== "انجام‌شده" && <MenuItem onSelect={async () => { try { await crm.save("tasks", { ...item, status: "انجام‌شده" }); toast.success("وظیفه انجام شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "وضعیت ذخیره نشد."); } }}><CheckCircle2 />علامت انجام‌شده</MenuItem>}
    details={(item, actions) => <div className="stack"><div className="spread"><Badge tone={taskTone[item.status]}>{item.status}</Badge><Button variant="outline" onClick={() => actions.edit(item)}><Pencil />ویرایش</Button></div>
      <Details rows={[["اولویت", item.priority], ["مسئول", item.owner], ["سررسید", shortDate(item.due) + " · " + faDigits(item.dueTime || "17:00")], ["یادآوری", item.reminder], ["مشتری", state.contacts.find((contact) => contact.id === item.contactId)?.name]]} />{item.description && <p>{item.description}</p>}</div>}
  />;
}
