"use client";

import { useMemo, useState } from "react";
import { type ColumnDef, type PaginationState, type RowSelectionState, type SortingState, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { CheckBox, Confirm, Input, Select } from "./ui/primitives";
import { Empty } from "./common";
import { fa, searchText } from "@shared/utils";
import { refreshCRM, useResource } from "@/lib/repository";
import { toast } from "sonner";

export interface Filter {
  key?: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}
const filterKeys: Record<string, string> = { "وضعیت": "status", "منبع": "source", "منبع جذب": "source", "مرحله": "stage", "نوع فعالیت": "type", "اولویت": "priority" };
export function DataTable<T extends { id: string }>({ rows, columns, searchBy, filters = [], selectionDelete, placeholder = "جست‌وجو…", toolbar, resource }: {
  rows: T[]; columns: ColumnDef<T>[]; searchBy: (row: T) => string; filters?: Filter[]; selectionDelete?: (ids: string[]) => void | Promise<unknown>; placeholder?: string; toolbar?: React.ReactNode; resource?: string;
}) {
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [confirm, setConfirm] = useState(false);
  const params = new URLSearchParams({ page: String(pagination.pageIndex), size: String(pagination.pageSize), search: query, sort: sorting[0]?.id || "", direction: sorting[0] ? sorting[0].desc ? "desc" : "asc" : "desc" });
  for (const filter of filters) { const key = filter.key || filterKeys[filter.label]; if (key && filter.value) params.set(key, filter.value); }
  const fetched = useResource<{ rows: T[]; total: number }>(resource ? "/api/crm/records/" + resource + "/?" + params.toString() : null, 160);
  const matching = resource ? fetched.data?.rows ?? [] : rows.filter((item) => searchText(searchBy(item)).includes(searchText(query)));
  const total = resource ? fetched.data?.total ?? 0 : matching.length;
  const defs = useMemo<ColumnDef<T>[]>(() => selectionDelete ? [{
    id: "select", header: ({ table }) => <CheckBox label="انتخاب همهٔ ردیف‌های صفحه" checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")} onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)} />,
    cell: ({ row }) => <CheckBox label="انتخاب ردیف" checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked === true)} />, enableSorting: false,
  }, ...columns] : columns, [columns, selectionDelete]);

  // TanStack Table owns controlled table state through its hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: matching, columns: defs, state: { sorting, rowSelection: selection, pagination }, getRowId: (row) => row.id,
    onSortingChange: (change) => { setSorting(change); setPagination((old) => ({ ...old, pageIndex: 0 })); }, onPaginationChange: setPagination, onRowSelectionChange: setSelection, getCoreRowModel: getCoreRowModel(),
    manualPagination: !!resource, manualSorting: !!resource, manualFiltering: !!resource, rowCount: total,
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(), autoResetPageIndex: false,
    enableMultiSort: !resource,
  });
  const selected = table.getSelectedRowModel().rows.map((row) => row.id);
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const current = resource ? pageIndex : Math.min(pageIndex, Math.max(0, table.getPageCount() - 1));
  const visible = table.getRowModel().rows.length ? table.getRowModel().rows : table.getSortedRowModel().rows.slice(current * pageSize, (current + 1) * pageSize);
  return <Card className="data-card">
    <div className="table-toolbar"><div className="table-search"><Search size={16} /><Input aria-label={placeholder} placeholder={placeholder} value={query} onChange={(event) => { setQuery(event.target.value); table.setPageIndex(0); }} /></div>
      {filters.map((filter) => <Select key={filter.label} aria-label={filter.label} value={filter.value} onChange={(event) => { filter.onChange(event.target.value); table.setPageIndex(0); }}><option value="">{filter.label} · همه</option>{filter.options.map((option) => <option key={option}>{option}</option>)}</Select>)}
      {toolbar}<div className="table-spacer" />
      {selected.length > 0 ? <Button variant="outline" size="sm" className="danger-text" onClick={() => setConfirm(true)}><Trash2 /> حذف {fa(selected.length)} مورد</Button> : <span className="muted text-xs">{fetched.loading ? "در حال بارگیری…" : fa(total) + " مورد"}</span>}
    </div>
    <Table><TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => {
      const sort = header.column.getIsSorted();
      return <TableHead key={header.id} scope="col" aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}>{header.isPlaceholder ? null : header.column.getCanSort() ?
        <button className="sort-heading" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{sort === "asc" ? <ArrowUp size={12} /> : sort === "desc" ? <ArrowDown size={12} /> : <ArrowDownUp size={11} />}</button>
        : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>;
    })}</TableRow>)}</TableHeader><TableBody>{visible.map((row) => <TableRow key={row.id} data-selected={row.getIsSelected() || undefined}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody></Table>
    {fetched.error ? <div className="row p-4"><p role="alert" className="danger-text">{fetched.error}</p><Button variant="outline" onClick={refreshCRM}>تلاش دوباره</Button></div> : !visible.length && <Empty title={fetched.loading ? "در حال بارگیری…" : undefined} description={fetched.loading ? undefined : "عبارت جست‌وجو یا فیلترها را تغییر دهید."} />}
    <div className="table-footer"><span>{matching.length ? "نمایش " + fa(current * pageSize + 1) + " تا " + fa(Math.min((current + 1) * pageSize, total)) + " از " + fa(total) : "۰ مورد"}</span>
      <div className="row">
        <Select aria-label="تعداد ردیف در صفحه" value={pageSize} onChange={(event) => { table.setPageSize(Number(event.target.value)); table.setPageIndex(0); }}>{[8, 16, 32].map((size) => <option key={size} value={size}>{fa(size)} ردیف</option>)}</Select>
        <Button variant="outline" size="icon" aria-label="صفحهٔ قبلی" disabled={current === 0} onClick={() => table.setPageIndex(current - 1)}><ChevronRight /></Button>
        <span className="page-counter">{fa(current + 1)}</span>
        <Button variant="outline" size="icon" aria-label="صفحهٔ بعدی" disabled={current + 1 >= table.getPageCount()} onClick={() => table.setPageIndex(current + 1)}><ChevronLeft /></Button>
      </div>
    </div>
    {selectionDelete && <Confirm open={confirm} close={() => setConfirm(false)} title="حذف موارد انتخاب‌شده" description={fa(selected.length) + " مورد انتخاب شده است. ادامه می‌دهید؟"} onConfirm={async () => { try { await selectionDelete(selected); setSelection({}); table.setPageIndex(0); } catch (error) { toast.error(error instanceof Error ? error.message : "حذف انجام نشد."); } }} />}
  </Card>;
}


