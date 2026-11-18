"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeading } from "./common";
import { Button } from "./ui/button";
import { Confirm, Modal } from "./ui/primitives";
import { DataTable, type Filter } from "./data-table";
import { RecordForm, type Field, type Fields } from "./record-form";
import { RecordMenu, useRecordRoute } from "./record-tools";
import { useCRM } from "@/lib/repository";

export interface RecordActions<T> {
  show: (item: T) => void;
  edit: (item: T) => void;
  remove: (item: T) => void;
}
export function RecordPage<T extends { id: string; name: string }>({
  title, description, singular, list, filtered, columns, filters, searchBy, fields, defaults, save, remove, details, summary, rowExtras, alternate, actions, allowBatch = false,
}: {
  title: string; description: string; singular: string; list: T[]; filtered?: T[];
  columns: (actions: RecordActions<T>) => ColumnDef<T>[]; filters?: Filter[]; searchBy: (item: T) => string;
  fields: Field[]; defaults: (item?: T) => Record<string, unknown>;
  save: (values: Fields, item?: T) => void | Promise<unknown>; remove: (ids: string[]) => void | Promise<unknown>;
  details?: (item: T, actions: RecordActions<T>) => React.ReactNode; summary?: React.ReactNode;
  rowExtras?: (item: T) => React.ReactNode; alternate?: (actions: RecordActions<T>) => React.ReactNode;
  actions?: React.ReactNode; allowBatch?: boolean;
}) {
  const route = useRecordRoute();
  const resource = usePathname().split("/")[1];
  const state = useCRM();
  const canEdit = !!state?.settings.grants?.includes("crm.write") && (resource !== "companies" || state.settings.grants.includes("crm.all"));
  const [deleting, setDeleting] = useState<T>();
  const detail = list.find((item) => item.id === route.detail);
  const edit = list.find((item) => item.id === route.edit);
  const controls: RecordActions<T> = { show: (item) => route.open({ id: item.id }), edit: (item) => route.open({ edit: item.id }), remove: setDeleting };
  const close = () => route.open({});
  const actionColumn: ColumnDef<T> = { id: "actions", header: "عملیات", enableSorting: false, cell: ({ row: { original: item } }) => {
    const editable = canEdit && !("isSystem" in item && item.isSystem);
    return <RecordMenu detail={details ? () => controls.show(item) : undefined} edit={editable ? () => controls.edit(item) : undefined} remove={editable ? () => controls.remove(item) : undefined}>{editable && rowExtras?.(item)}</RecordMenu>;
  } };
  async function removeItems(ids: string[]) {
    try { await remove(ids); toast.success("حذف شد."); if (detail && ids.includes(detail.id)) close(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "حذف اطلاعات انجام نشد."); }
  }
  return <>
    <PageHeading title={title} description={description} actions={<>{actions}{canEdit && <Button onClick={() => route.open({ new: "1" })}><Plus /> افزودن {singular}</Button>}</>} />
    {summary}
    {alternate ? alternate(controls) : <DataTable resource={resource} rows={filtered ?? list} columns={[...columns(controls), actionColumn]} searchBy={searchBy} filters={filters} selectionDelete={canEdit && allowBatch ? removeItems : undefined} placeholder={"جست‌وجوی " + singular + "…"} />}
    <Modal open={canEdit && (route.create || !!edit)} onOpenChange={(open) => { if (!open) close(); }} title={(edit ? "ویرایش " : "افزودن ") + singular}>
      <RecordForm key={edit?.id || "new"} fields={fields} initial={defaults(edit)} onCancel={close} onSave={async (values) => {
        await save(values, edit); toast.success(edit ? "تغییرات ذخیره شد." : singular + " اضافه شد."); close();
      }} />
    </Modal>
    {details && detail && <Modal open onOpenChange={(open) => { if (!open) close(); }} title={detail.name} sheet>{details(detail, controls)}</Modal>}
    <Confirm open={!!deleting} close={() => setDeleting(undefined)} title={"حذف " + singular} description={deleting?.name + " حذف شود؟"} onConfirm={() => { if (deleting) removeItems([deleting.id]); }} />
  </>;
}


