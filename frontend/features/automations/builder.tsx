"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleCheck, Clock3, GitBranch, Link2, Maximize, Minus, Play, Plus, Save, Trash2, Workflow as WorkflowIcon, Zap } from "lucide-react";
import { Background, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Input, Modal, Select, Switch, Textarea } from "@/components/ui/primitives";
import { Empty, IconTile, PageHeading, PanelHeading } from "@/components/common";
import { crm, useCRM } from "@/lib/repository";
import { contactStatuses, type NodeKind, type Workflow, type WorkflowNode, type WorkflowRun } from "@shared/model";
import { digits, fa, humanDate, id } from "@shared/utils";
import { branchLabels, composite, configLabel, configurationError, getPredicates, initialScenario, kinds, operations, predicateTypes, validateWorkflow, type Scenario } from "@shared/workflow";

const icons = { trigger: Zap, condition: GitBranch, action: WorkflowIcon, delay: Clock3 };
const nodeTones = { trigger: "indigo", condition: "amber", action: "green", delay: "cyan" };
const kindsList = Object.keys(kinds) as NodeKind[];
type FlowNode = Node<{ kind: NodeKind; operation: string; value: string; result?: "موفق" | "رد شد" | "خطا" | "در حال اجرا"; active?: boolean }, "operation">;
function flowNode(node: WorkflowNode): FlowNode {
  return { id: node.id, position: node.position, type: "operation", data: { kind: node.kind, operation: node.operation, value: node.value }, ariaLabel: node.operation };
}
function FlowCard({ data, selected }: NodeProps<FlowNode>) {
  return <article dir="rtl" className={"flow-node tone-" + nodeTones[data.kind] + (selected || data.active ? " selected" : "")}>
    {data.kind !== "trigger" && <Handle type="target" position={Position.Right} aria-label="ورودی نود" />}
    <IconTile icon={icons[data.kind]} tone={nodeTones[data.kind]} />
    <div><small>{kinds[data.kind]}</small><b>{data.operation}</b>{data.result && <span className={data.result === "موفق" ? "node-success" : data.result === "خطا" ? "danger-text" : "muted"}>{data.result}</span>}</div>
    {data.kind === "condition" ? <><Handle type="source" position={Position.Left} id="yes" style={{ top: "34%", background: "#27a980" }} aria-label="شاخهٔ درست" /><Handle type="source" position={Position.Left} id="no" style={{ top: "69%", background: "#e16b7e" }} aria-label="شاخهٔ نادرست" /></> :
      <Handle type="source" position={Position.Left} aria-label="خروجی نود" />}
  </article>;
}
const nodeTypes = { operation: FlowCard };
const flowEdge = (edge: Workflow["links"][number]): Edge => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.branch, label: edge.branch ? branchLabels[edge.branch] : undefined, ariaLabel: edge.branch ? "اتصال در مسیر " + branchLabels[edge.branch] : "اتصال گردش‌کار", markerEnd: { type: MarkerType.ArrowClosed, color: "#8b84ab" }, style: { stroke: "#8b84ab", strokeWidth: 1.6 } });

export default function WorkflowBuilder() {
  const state = useCRM();
  const key = useSearchParams().get("id");
  if (!state) return null;
  const saved = key ? state.workflows.find((flow) => flow.id === key) : undefined;
  if (key && !saved) return <Card><Empty title="گردش‌کار پیدا نشد" /><div className="p-4 text-center"><Button asChild variant="outline"><Link href="/automations/">بازگشت به اتوماسیون</Link></Button></div></Card>;
  return <ReactFlowProvider key={key || "new"}><Builder saved={saved} owners={state.settings.users.filter((item) => item.active).map((item) => item.name)} /></ReactFlowProvider>;
}
function Builder({ saved, owners }: { saved?: Workflow; owners: string[] }) {
  const router = useRouter();
  const instance = useReactFlow<FlowNode>();
  const [workflowId] = useState(() => saved?.id || id());
  const [name, setName] = useState(saved?.name || "");
  const [description, setDescription] = useState(saved?.description || "");
  const [enabled, setEnabled] = useState(saved?.enabled || false);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(saved?.nodes.map(flowNode) || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved?.links.map(flowEdge) || []);
  const [selected, setSelected] = useState<string>();
  const [target, setTarget] = useState("");
  const [branch, setBranch] = useState("yes");
  const [errors, setErrors] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario>(initialScenario);
  const [showScenario, setShowScenario] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowVersion, setRowVersion] = useState(saved?.rowVersion);
  const [latest, setLatest] = useState<WorkflowRun | undefined>(saved?.runs[0]);
  const [localRuns, setLocalRuns] = useState<WorkflowRun[]>([]);
  const item = nodes.find((node) => node.id === selected);
  const selection = useRef<string>(undefined);
  const visualNodes = useMemo(() => {
    const statusByNode = new Map(latest?.steps.map((step) => [step.nodeId, step.result]));
    return nodes.map((node) => ({ ...node, data: { ...node.data, result: statusByNode.get(node.id), active: node.id === selected } }));
  }, [nodes, latest, selected]);
  const logs = [...new Map([...(saved?.runs || []), ...localRuns].map((run) => [run.id, run])).values()].sort((a, b) => b.date.localeCompare(a.date));
  const select = useCallback((nodeId?: string) => {
    if (selection.current === nodeId) return;
    selection.current = nodeId;
    setSelected(nodeId); setTarget(""); setBranch("yes");
  }, []);
  const selectionChanged = useCallback(({ nodes: selectedNodes }: { nodes: FlowNode[] }) => {
    if (selectedNodes.length === 1) select(selectedNodes[0].id);
  }, [select]);
  function payload(): Workflow {
    return { id: workflowId, name: name.trim(), description: description.trim(), enabled, rowVersion, created: saved?.created || new Date().toISOString(),
      nodes: nodes.map((node) => ({ id: node.id, position: node.position, kind: node.data.kind, operation: node.data.operation, value: node.data.value.trim() })),
      links: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, branch: edge.sourceHandle || undefined })), runs: logs };
  }
  function add(kind: NodeKind, position?: { x: number; y: number }) {
    if (kind === "trigger" && nodes.some((node) => node.data.kind === "trigger")) { toast.error("یک آغازگر از قبل وجود دارد."); return; }
    const operation = operations[kind][0];
    const next = flowNode({ id: id(), kind, operation, value: "", position: position ?? { x: 350 - (nodes.length % 2) * 245, y: 70 + Math.floor(nodes.length / 2) * 108 } });
    setNodes((current) => [...current, next]); select(next.id); setLatest(undefined);
    if (!position) window.requestAnimationFrame(() => { void instance.fitView({ duration: 220, maxZoom: 1 }); });
  }
  function canConnect({ source, target, sourceHandle }: Pick<Connection, "source" | "target" | "sourceHandle">) {
    if (!source || !target || source === target || nodes.find((node) => node.id === target)?.data.kind === "trigger") return false;
    if (sourceHandle && edges.some((edge) => edge.source === source && edge.sourceHandle === sourceHandle)) return false;
    if (edges.some((edge) => edge.source === source && edge.target === target && (edge.sourceHandle || null) === sourceHandle)) return false;
    const seen = new Set<string>();
    function reaches(node: string): boolean {
      if (node === source) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return edges.some((edge) => edge.source === node && reaches(edge.target));
    }
    return !reaches(target);
  }
  function connect(connection: Connection) {
    if (!canConnect(connection)) { toast.error("این اتصال مجاز نیست یا قبلاً ثبت شده است."); return; }
    const edge = flowEdge({ id: id(), source: connection.source, target: connection.target, branch: connection.sourceHandle || undefined });
    setEdges((current) => addEdge(edge, current)); setLatest(undefined);
  }
  function update(data: Partial<FlowNode["data"]>) {
    setNodes((current) => current.map((node) => node.id === selected ? { ...node, data: { ...node.data, ...data }, ariaLabel: data.operation || node.ariaLabel } : node));
    setLatest(undefined);
  }
  function removeSelected() {
    setNodes((current) => current.filter((node) => node.id !== selected));
    setEdges((current) => current.filter((edge) => edge.source !== selected && edge.target !== selected));
    select(undefined); setLatest(undefined);
  }
  async function save() {
    if (saving || running) return;
    const flow = payload();
    if (!flow.name) { setErrors(["نام گردش‌کار را وارد کنید."]); return; }
    const issues = validateWorkflow(flow);
    setErrors(issues);
    if (flow.enabled && issues.length) { toast.error("برای ذخیرهٔ گردش‌کار فعال، خطاها را رفع کنید."); return; }
    setSaving(true);
    try {
      const record = await crm.save("workflows", flow);
      setRowVersion(record.rowVersion);
      toast.success(issues.length ? "پیش‌نویس غیرفعال ذخیره شد." : "گردش‌کار ذخیره شد.");
      if (!saved) router.replace("/automations/builder/?id=" + flow.id);
      setLocalRuns([]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیرهٔ گردش‌کار انجام نشد."); }
    finally { setSaving(false); }
  }
  async function run() {
    if (saving || running || !/^\d{1,20}$/.test(digits(scenario.dealValue))) { toast.error("ارزش معاملهٔ سناریو باید معتبر باشد."); return; }
    setShowScenario(false); setRunning(true);
    const flow = payload();
    const issues = validateWorkflow(flow);
    setErrors(issues);
    try {
      const result = await crm.testWorkflow(flow, scenario);
      setLatest(result);
      setLocalRuns((current) => [result, ...current]);
      if (result.result === "موفق") toast.success("اجرای آزمایشی ثبت شد.");
      else toast.error("گردش‌کار خطای اعتبارسنجی دارد.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "ذخیرهٔ لاگ انجام نشد."); }
    finally { setRunning(false); }
  }
  return <div className="stack">
    <PageHeading title={saved ? "طراح گردش‌کار" : "اتوماسیون جدید"} description="نودها را به بوم اضافه کنید و خروجی هر مرحله را به ورودی مرحلهٔ بعد وصل کنید."
      actions={<><Button asChild variant="outline"><Link href="/automations/"><ArrowRight />فهرست</Link></Button><Button variant="outline" onClick={() => { const issues = validateWorkflow(payload()); setErrors(issues); if (!issues.length) toast.success("ساختار گردش‌کار معتبر است."); }}><CircleCheck />اعتبارسنجی</Button>
        <Button variant="outline" onClick={() => setShowScenario(true)} disabled={running}><Play />{running ? "در حال اجرا…" : "اجرای آزمایشی"}</Button><Button onClick={save} disabled={running || saving}><Save />{saving ? "در حال ذخیره…" : "ذخیره"}</Button></>} />
    <Card className="flow-meta">
      <label className="field-label">نام گردش‌کار<Input value={name} placeholder="مثلاً پیگیری مشتریان جدید" onChange={(event) => setName(event.target.value)} /></label>
      <label className="field-label">توضیحات<Input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <div className="row"><Switch label="فعال‌سازی گردش‌کار" checked={enabled} onCheckedChange={(value) => { const issues = value ? validateWorkflow(payload()) : []; setErrors(issues); if (!issues.length) setEnabled(value); }} /><Badge tone={enabled ? "green" : "neutral"}>{enabled ? "فعال" : "غیرفعال"}</Badge></div>
    </Card>
    {errors.length > 0 && <Card className="flow-errors" role="alert"><h2>موارد نیازمند اصلاح</h2><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></Card>}
    <div className="flow-layout">
      <Card className="flow-palette"><h2>افزودن نود</h2>{kindsList.map((kind) => <button type="button" className="flow-palette-item" draggable key={kind} onDragStart={(event) => { event.dataTransfer.setData("application/hamsir-node", kind); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => add(kind)}><IconTile icon={icons[kind]} tone={nodeTones[kind]} /><b>{kinds[kind]}</b><Plus size={14} /></button>)}</Card>
      <Card className="flow-canvas" dir="ltr" onDragOver={(event) => { if (event.dataTransfer.types.includes("application/hamsir-node")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDrop={(event) => {
        event.preventDefault(); const kind = kindsList.find((key) => key === event.dataTransfer.getData("application/hamsir-node"));
        if (kind) add(kind, instance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }}>
        <ReactFlow<FlowNode> nodes={visualNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={connect} isValidConnection={(connection) => canConnect({ source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle || null })}
          onNodeClick={(_, node) => select(node.id)} onSelectionChange={selectionChanged} onPaneClick={() => select(undefined)} onNodesDelete={() => { select(undefined); setLatest(undefined); }}
          fitView fitViewOptions={{ maxZoom: 1, padding: 0.25 }} minZoom={0.3} maxZoom={2}
          ariaLabelConfig={{ "node.a11yDescription.default": "برای انتخاب کلید Enter را بزنید. برای حرکت نود از کلیدهای جهت استفاده کنید.", "edge.a11yDescription.default": "برای انتخاب اتصال کلید Enter را بزنید.", "minimap.ariaLabel": "نقشهٔ کوچک گردش‌کار" }}
        ><Background color="var(--line-strong)" gap={16} size={1.2} /><MiniMap pannable zoomable nodeColor="#8174e4" maskColor="#8a81c225" style={{ background: "var(--surface)", width: 104, height: 72 }} /></ReactFlow>
        {!nodes.length && <div className="flow-placeholder" dir="rtl">برای شروع یک آغازگر اضافه کنید.</div>}
        <div className="flow-controls" dir="rtl">
          <Button size="icon" variant="outline" aria-label="بزرگ‌نمایی" onClick={() => instance.zoomIn({ duration: 150 })}><Plus /></Button>
          <Button size="icon" variant="outline" aria-label="کوچک‌نمایی" onClick={() => instance.zoomOut({ duration: 150 })}><Minus /></Button>
          <Button size="icon" variant="outline" aria-label="نمایش همهٔ نودها" onClick={() => instance.fitView({ duration: 200, maxZoom: 1 })}><Maximize /></Button>
        </div>
      </Card>
      <Card className="flow-inspector"><h2>تنظیمات نود</h2>{item ? <>
        <div className="row"><IconTile icon={icons[item.data.kind]} tone={nodeTones[item.data.kind]} /><b>{kinds[item.data.kind]}</b></div>
        <label className="field-label">نوع عملیات<Select value={item.data.operation} onChange={(event) => update({ operation: event.target.value, value: "" })}>{operations[item.data.kind].map((operation) => <option key={operation}>{operation}</option>)}</Select></label>
        {item.data.kind === "condition" && composite(item.data.operation) ? getPredicates(item.data.value).map((entry, index, all) => {
          const change = (predicate: typeof entry) => update({ value: JSON.stringify(all.map((current, i) => i === index ? predicate : current)) });
          return <div className="flow-predicate" key={index}><label className="field-label">شرط {fa(index + 1)}<Select value={entry.operation} onChange={(event) => change({ operation: event.target.value, value: "" })}>{predicateTypes.map((operation) => <option key={operation}>{operation}</option>)}</Select></label>
            <ConfigInput kind="condition" operation={entry.operation} value={entry.value} owners={owners} onChange={(value) => change({ ...entry, value })} /></div>;
        }) : <ConfigInput kind={item.data.kind} operation={item.data.operation} value={item.data.value} owners={owners} onChange={(value) => update({ value })} />}
        {configurationError(item.data) && <span className="field-error">{configurationError(item.data)}</span>}
        <hr className="border-border" />
        <label className="field-label">اتصال به نود<Select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">انتخاب مقصد</option>{nodes.filter((node) => node.id !== selected && node.data.kind !== "trigger").map((node, index) => <option key={node.id} value={node.id}>{fa(index + 1)} · {node.data.operation}</option>)}</Select></label>
        {item.data.kind === "condition" && <label className="field-label">مسیر خروجی<Select value={branch} onChange={(event) => setBranch(event.target.value)}>{Object.entries(branchLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label>}
        <Button variant="outline" size="sm" disabled={!target} onClick={() => { connect({ source: item.id, target, sourceHandle: item.data.kind === "condition" ? branch : null, targetHandle: null }); setTarget(""); }}><Link2 />افزودن اتصال</Button>
        {edges.filter((edge) => edge.source === selected).map((edge) => <div className="spread flow-connection" key={edge.id}><span>{edge.label && edge.label + " · "}{nodes.find((node) => node.id === edge.target)?.data.operation}</span><Button size="icon" variant="ghost" aria-label="حذف اتصال" onClick={() => { setEdges((current) => current.filter((link) => link.id !== edge.id)); setLatest(undefined); }}><Trash2 /></Button></div>)}
        <Button variant="ghost" size="sm" className="danger-text" onClick={removeSelected}><Trash2 />حذف نود</Button>
      </> : <p className="muted">نودی را روی بوم انتخاب کنید.</p>}</Card>
    </div>
    <Card><PanelHeading title="مسیر اجرا و لاگ‌ها" description="نتیجهٔ مراحل در اجرای دستی" icon={Play} action={logs.length ? <Select aria-label="انتخاب اجرای آزمایشی" className="w-auto" value={latest?.id || ""} onChange={(event) => setLatest(logs.find((log) => log.id === event.target.value))}><option value="">انتخاب اجرا</option>{logs.map((log) => <option key={log.id} value={log.id}>{humanDate(log.date, "d MMMM، HH:mm:ss")} · {log.result}</option>)}</Select> : undefined} />
      <CardContent>{latest ? <div className="stack"><Badge tone={latest.result === "موفق" ? "green" : "red"}>{latest.result}</Badge><ol className="run-path">{latest.steps.map((step) => <li key={step.nodeId}><span>{step.title}</span><Badge tone={step.result === "موفق" ? "green" : step.result === "خطا" ? "red" : "amber"}>{step.result}</Badge><small>{step.message}</small></li>)}</ol></div> : <Empty title="اجرایی انتخاب نشده است" description="با اجرای آزمایشی، نتیجهٔ هر نود را اینجا ببینید." icon={WorkflowIcon} />}</CardContent>
    </Card>
    <Modal title="سناریوی اجرای آزمایشی" description="مقادیر نمونه برای بررسی شاخه‌ها و اقدامات گردش‌کار." open={showScenario} onOpenChange={setShowScenario}>
      <form onSubmit={(event) => { event.preventDefault(); void run(); }}>
        <div className="form-grid">
          <label className="field-label">وضعیت مشتری<Select value={scenario.status} onChange={(event) => setScenario({ ...scenario, status: event.target.value })}>{contactStatuses.map((status) => <option key={status}>{status}</option>)}</Select></label>
          <label className="field-label">ارزش معامله (تومان)<Input inputMode="numeric" value={scenario.dealValue} onChange={(event) => setScenario({ ...scenario, dealValue: event.target.value })} /></label>
          <label className="field-label">کارشناس<Select value={scenario.owner} onChange={(event) => setScenario({ ...scenario, owner: event.target.value })}><option value="">بدون کارشناس</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</Select></label>
          <label className="field-label">برچسب‌ها<Input value={scenario.tags} onChange={(event) => setScenario({ ...scenario, tags: event.target.value })} /></label>
          <label className="field-label">نام مشتری<Input value={scenario.customer} onChange={(event) => setScenario({ ...scenario, customer: event.target.value })} /></label>
          <label className="field-label">نام شرکت<Input value={scenario.company} onChange={(event) => setScenario({ ...scenario, company: event.target.value })} /></label>
        </div><div className="dialog-actions"><Button type="submit" disabled={running}><Play />اجرا</Button></div>
      </form>
    </Modal>
  </div>;
}
function ConfigInput({ kind, operation, value, owners, onChange }: { kind: NodeKind; operation: string; value: string; owners: string[]; onChange: (value: string) => void }) {
  const label = configLabel({ kind, operation });
  if (!label) return null;
  const options = label === "وضعیت مشتری" ? contactStatuses : label === "نام کارشناس" ? owners : null;
  const handle = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value);
  return <label className="field-label">{label}
    {options ? <Select value={value} onChange={handle}><option value="">انتخاب کنید</option>{options.map((option) => <option key={option}>{option}</option>)}</Select> :
      label.startsWith("متن") ? <Textarea value={value} onChange={handle} /> :
      <Input value={value} onChange={handle} inputMode={kind === "delay" || operation === predicateTypes[1] ? "numeric" : undefined} dir={label.includes("نشانی") || kind === "trigger" ? "ltr" : "rtl"} />}
  </label>;
}
