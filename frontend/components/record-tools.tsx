"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ellipsis, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Menu, MenuItem, MenuSeparator } from "./ui/primitives";

export function useRecordRoute() {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  function open(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    ["new", "id", "edit"].forEach((key) => next.delete(key));
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    router.replace(path + (next.size ? "?" + next.toString() : ""), { scroll: false });
  }
  return { detail: params.get("id"), edit: params.get("edit"), create: params.has("new"), open };
}
export function RecordMenu({ detail, edit, remove, children }: { detail?: () => void; edit?: () => void; remove?: () => void; children?: React.ReactNode }) {
  return <Menu trigger={<Button size="icon" variant="ghost" aria-label="عملیات ردیف"><Ellipsis /></Button>}>
    {detail && <MenuItem onSelect={detail}><Eye /> مشاهدهٔ جزئیات</MenuItem>}
    {edit && <MenuItem onSelect={edit}><Pencil /> ویرایش</MenuItem>}
    {children}
    {remove && <><MenuSeparator /><MenuItem className="danger-text" onSelect={remove}><Trash2 /> حذف</MenuItem></>}
  </Menu>;
}
export function Details({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="detail-grid">{rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || "—"}</dd></div>)}</dl>;
}

