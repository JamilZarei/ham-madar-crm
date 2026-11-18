"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, CirclePlay, Copy, GitBranch, Plus, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";
import { crm, useCRM } from "@/lib/repository";
import { type Workflow } from "@shared/model";
import { fa, humanDate, id, shortDate } from "@shared/utils";
import { DataTable } from "@/components/data-table";
import { PageHeading, Stat } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge, Confirm, MenuItem, Switch } from "@/components/ui/primitives";
import { RecordMenu } from "@/components/record-tools";
import { validateWorkflow } from "@shared/workflow";

export default function Automations() {
  const state = useCRM();
  const [status, setStatus] = useState("");
  const [deleting, setDeleting] = useState<Workflow>();
  if (!state) return null;
  const flows = state.workflows;
  async function toggle(item: Workflow, enabled: boolean) {
    if (enabled) {
      const errors = validateWorkflow(item);
      if (errors.length) { toast.error(errors[0]); return; }
    }
    try { await crm.toggleWorkflow(item.id, enabled); toast.success(enabled ? "اتوماسیون فعال شد." : "اتوماسیون غیرفعال شد."); }
    catch { toast.error("تغییر وضعیت انجام نشد."); }
  }
  return <>
    <PageHeading title="اتوماسیون" description="گردش‌کارهای تیم را طراحی کنید و مسیر اجرای آن‌ها را به‌صورت آزمایشی بررسی کنید." actions={<Button asChild><Link href="/automations/builder/"><Plus />ایجاد اتوماسیون</Link></Button>} />
    <div className="stat-grid record-stats"><Stat label="گردش‌کارها" icon={WorkflowIcon} value={fa(state.stats?.workflowCount ?? flows.length)} /><Stat label="اتوماسیون‌های فعال" icon={Activity} tone="green" value={fa(state.stats?.enabledWorkflows ?? 0)} /><Stat label="اجراهای آزمایشی" icon={CirclePlay} tone="cyan" value={fa(state.stats?.workflowRuns ?? 0)} /></div>
    <DataTable resource="workflows" rows={flows.filter((item) => !status || status === (item.enabled ? "فعال" : "غیرفعال"))} searchBy={(item) => item.name + " " + item.description + " " + item.nodes.find((node) => node.kind === "trigger")?.operation}
      filters={[{ label: "وضعیت", options: ["فعال", "غیرفعال"], value: status, onChange: setStatus }]}
      columns={[
        { accessorKey: "name", header: "گردش‌کار", cell: ({ row }) => <Link className="table-person" href={"/automations/builder/?id=" + row.original.id}><GitBranch size={17} className="muted" /><span><b>{row.original.name}</b><small>{row.original.description}</small></span></Link> },
        { id: "trigger", accessorFn: (item) => item.nodes.find((node) => node.kind === "trigger")?.operation || "—", header: "آغازگر" },
        { accessorKey: "enabled", header: "وضعیت", cell: ({ row }) => <div className="row"><Switch label={"فعال‌سازی " + row.original.name} checked={row.original.enabled} onCheckedChange={(enabled) => toggle(row.original, enabled)} /><Badge tone={row.original.enabled ? "green" : "neutral"}>{row.original.enabled ? "فعال" : "غیرفعال"}</Badge></div> },
        { id: "count", accessorFn: (item) => item.runCount ?? item.runs.length, header: "تعداد اجرا", cell: ({ getValue }) => fa(Number(getValue())) },
        { id: "last", accessorFn: (item) => item.lastRunAt ?? item.runs[0]?.date ?? "", header: "آخرین اجرا", cell: ({ row }) => row.original.lastRunAt ? humanDate(row.original.lastRunAt, "d MMMM، HH:mm") : "—" },
        { accessorKey: "created", header: "تاریخ ایجاد", cell: ({ row }) => shortDate(row.original.created) },
        { id: "actions", header: "عملیات", enableSorting: false, cell: ({ row }) => <RecordMenu remove={() => setDeleting(row.original)}>
          <MenuItem asChild><Link href={"/automations/builder/?id=" + row.original.id}><GitBranch />ویرایش گردش‌کار</Link></MenuItem>
          <MenuItem onSelect={async () => { try { await crm.save("workflows", { ...row.original, rowVersion: undefined, id: id(), name: row.original.name + " (نسخهٔ کپی)", enabled: false, created: new Date().toISOString(), runs: [] }); toast.success("نسخهٔ کپی ایجاد شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "کپی انجام نشد."); } }}><Copy />کپی</MenuItem>
        </RecordMenu> },
      ]} />
    <Confirm open={!!deleting} close={() => setDeleting(undefined)} title="حذف اتوماسیون" description={(deleting?.name || "") + " بایگانی شود؟"} onConfirm={async () => { if (deleting) try { await crm.remove("workflows", [deleting.id]); toast.success("اتوماسیون بایگانی شد."); } catch (error) { toast.error(error instanceof Error ? error.message : "بایگانی انجام نشد."); } }} />
  </>;
}
