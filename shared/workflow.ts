import { type NodeKind, type Workflow, type WorkflowNode, type WorkflowRun, type WorkflowStep, contactStatuses } from "@shared/model";
import { digits, fa, id, money } from "@shared/utils";

export const kinds: Record<NodeKind, string> = { trigger: "آغازگر", condition: "شرط", action: "اقدام", delay: "تأخیر" };
export const operations: Record<NodeKind, string[]> = {
  trigger: ["ایجاد مشتری جدید", "ایجاد سرنخ جدید", "تغییر وضعیت مشتری", "ایجاد فرصت فروش", "تغییر مرحله معامله", "نزدیکی سررسید", "ایجاد وظیفه", "زمان‌بندی‌شده"],
  condition: ["وضعیت مشتری برابر است", "ارزش معامله بیشتر است", "مشتری برچسب دارد", "کارشناس برابر است", "همهٔ شرط‌ها (و)", "یکی از شرط‌ها (یا)"],
  action: ["ارسال پیامک", "ایجاد وظیفه", "تغییر وضعیت مشتری", "تخصیص کارشناس", "افزودن برچسب", "ثبت یادداشت", "ایجاد اعلان", "ارسال ایمیل نمایشی", "فراخوانی وب‌هوک نمایشی"],
  delay: ["انتظار به دقیقه", "انتظار به ساعت", "انتظار به روز"],
};
export const branchLabels: Record<string, string> = { yes: "درست", no: "نادرست" };
export const predicateTypes = operations.condition.slice(0, 4);
type Predicate = { operation: string; value: string };
export const composite = (operation: string) => operations.condition.slice(4).includes(operation);
export function getPredicates(value: string): Predicate[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((item) => typeof item?.operation === "string" && typeof item.value === "string")) return parsed as Predicate[];
  } catch {}
  return [{ operation: predicateTypes[0], value: "" }, { operation: predicateTypes[1], value: "" }];
}
export function configLabel(node: Pick<WorkflowNode, "kind" | "operation">) {
  if (node.kind === "delay") return "مدت انتظار";
  if (node.kind === "trigger") return node.operation === "زمان‌بندی‌شده" ? "زمان روزانه (ساعت:دقیقه)" : "";
  switch (node.operation) {
    case "وضعیت مشتری برابر است":
    case "تغییر وضعیت مشتری": return "وضعیت مشتری";
    case "ارزش معامله بیشتر است": return "حداقل ارزش معامله (تومان)";
    case "مشتری برچسب دارد":
    case "افزودن برچسب": return "نام برچسب";
    case "کارشناس برابر است":
    case "تخصیص کارشناس": return "نام کارشناس";
    case "ایجاد وظیفه": return "عنوان وظیفه";
    case "ارسال پیامک":
    case "ارسال ایمیل نمایشی": return "متن پیام";
    case "فراخوانی وب‌هوک نمایشی": return "نشانی وب‌هوک";
    case "ایجاد اعلان": return "متن اعلان";
    case "ثبت یادداشت": return "متن یادداشت";
    default: return "";
  }
}
export function configurationError(node: Pick<WorkflowNode, "kind" | "operation" | "value">): string | undefined {
  if (!operations[node.kind].includes(node.operation)) return "نوع عملیات را انتخاب کنید.";
  if (node.kind === "condition" && composite(node.operation)) {
    const predicates = getPredicates(node.value);
    if (predicates.some((item) => !predicateTypes.includes(item.operation) || configurationError({ kind: "condition", ...item }))) return "هر دو شرط و مقدار آن‌ها را مشخص کنید.";
    return;
  }
  const label = configLabel(node);
  const value = node.value.trim();
  if (label && !value) return label + " را وارد کنید.";
  if (node.kind === "delay" && (!/^\d+$/.test(digits(value)) || Number(digits(value)) < 1)) return "مدت انتظار باید عدد صحیح مثبت باشد.";
  if (node.kind === "trigger" && label && !/^([01]\d|2[0-3]):[0-5]\d$/.test(digits(value))) return "زمان روزانه را مانند ۰۹:۳۰ وارد کنید.";
  if (node.operation === "ارزش معامله بیشتر است" && !/^\d{1,20}$/.test(digits(value))) return "ارزش معامله را به تومان وارد کنید.";
  if (label === "وضعیت مشتری" && !contactStatuses.some((item) => item === value)) return "وضعیت معتبری انتخاب کنید.";
  if (node.operation === "فراخوانی وب‌هوک نمایشی") {
    try { const url = new URL(value); if (!["https:", "http:"].includes(url.protocol)) return "نشانی وب‌هوک معتبر نیست."; }
    catch { return "نشانی وب‌هوک معتبر نیست."; }
  }
}
export function validateWorkflow(flow: Workflow): string[] {
  const issues = new Set<string>();
  if (!flow.name.trim()) issues.add("نام گردش‌کار را وارد کنید.");
  const triggers = flow.nodes.filter((node) => node.kind === "trigger");
  if (triggers.length !== 1) issues.add("گردش‌کار باید یک آغازگر داشته باشد.");
  if (!flow.nodes.some((node) => node.kind === "action")) issues.add("دست‌کم یک اقدام اضافه کنید.");
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  for (const link of flow.links) {
    if (!nodes.has(link.source) || !nodes.has(link.target)) issues.add("اتصالی به نود حذف‌شده اشاره می‌کند.");
    if (nodes.get(link.target)?.kind === "trigger") issues.add("آغازگر نمی‌تواند اتصال ورودی داشته باشد.");
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) { issues.add("اتصال حلقوی در گردش‌کار وجود دارد."); return; }
    if (visited.has(key)) return;
    visiting.add(key);
    flow.links.filter((link) => link.source === key).forEach((link) => visit(link.target));
    visiting.delete(key); visited.add(key);
  }
  if (triggers.length === 1) visit(triggers[0].id);
  for (const node of flow.nodes) {
    const error = configurationError(node);
    if (error) issues.add(node.operation + " · " + error);
    if (triggers.length === 1 && !visited.has(node.id)) issues.add("نود «" + node.operation + "» به مسیر آغازگر متصل نیست.");
    const outgoing = flow.links.filter((link) => link.source === node.id);
    if (node.kind !== "action" && !outgoing.length) issues.add("خروجی «" + node.operation + "» را متصل کنید.");
    if (node.kind === "condition") {
      if (outgoing.some((link) => !link.branch || !branchLabels[link.branch])) issues.add("خروجی شرط باید از مسیر درست یا نادرست متصل شود.");
      if (new Set(outgoing.map((link) => link.branch)).size < outgoing.length) issues.add("هر مسیر خروجی شرط فقط یک اتصال می‌پذیرد.");
    }
  }
  return [...issues];
}

export interface Scenario { status: string; dealValue: string; tags: string; owner: string; customer: string; company: string }
export const initialScenario: Scenario = { status: "فعال", dealValue: "۵۰۰۰۰۰۰۰", tags: "مشتری کلیدی", owner: "آرمان رضایی", customer: "مهسا صادقی", company: "رادین‌پرداز" };
function matches(operation: string, value: string, input: Scenario): boolean {
  if (composite(operation)) {
    const results = getPredicates(value).map((item) => matches(item.operation, item.value, input));
    return operation === operations.condition[4] ? results.every(Boolean) : results.some(Boolean);
  }
  if (operation === predicateTypes[0]) return input.status === value;
  if (operation === predicateTypes[1]) return BigInt(digits(input.dealValue) || "0") > BigInt(digits(value));
  if (operation === predicateTypes[2]) return input.tags.split(/[،,]/).map((tag) => tag.trim()).includes(value);
  return input.owner === value;
}
function describe(node: WorkflowNode, input: Scenario) {
  if (node.kind === "trigger") return node.value ? "رویداد زمان‌بندی‌شده برای " + node.value + " شبیه‌سازی شد." : "رویداد آغازگر به‌صورت آزمایشی دریافت شد.";
  if (node.kind === "delay") return node.operation + " · " + fa(Number(digits(node.value))) + "، زمان انتظار در آزمایش شبیه‌سازی شد.";
  const value = node.value.replaceAll("{{customer_name}}", input.customer).replaceAll("{{company_name}}", input.company);
  return node.operation + " شبیه‌سازی شد · " + value;
}
export function simulateWorkflow(flow: Workflow, input: Scenario): WorkflowRun {
  const issues = validateWorkflow(flow);
  const run: WorkflowRun = { id: id(), date: new Date().toISOString(), result: issues.length ? "خطا" : "موفق", steps: [] };
  if (issues.length) {
    run.steps = issues.map((message, index) => ({ nodeId: "error-" + index, title: "اعتبارسنجی گردش‌کار", result: "خطا", message }));
    return run;
  }
  const trigger = flow.nodes.find((node) => node.kind === "trigger");
  const processed = new Set<string>();
  const queue = trigger ? [trigger.id] : [];
  while (queue.length) {
    const key = queue.shift();
    const node = flow.nodes.find((item) => item.id === key);
    if (!node || processed.has(node.id)) continue;
    processed.add(node.id);
    const outgoing = flow.links.filter((link) => link.source === node.id);
    if (node.kind === "condition") {
      const passed = matches(node.operation, node.value, input);
      const branch = passed ? "yes" : "no";
      const next = outgoing.filter((link) => link.branch === branch);
      const detail = node.operation === predicateTypes[1] ? " · ارزش سناریو " + money(digits(input.dealValue)) : "";
      run.steps.push({ nodeId: node.id, title: node.operation, result: passed ? "موفق" : "رد شد", message: "نتیجه: " + branchLabels[branch] + detail + (next.length ? "" : " · این شاخه اتصال خروجی ندارد.") });
      queue.push(...next.map((link) => link.target));
    } else {
      run.steps.push({ nodeId: node.id, title: node.operation, result: "موفق", message: describe(node, input) });
      queue.push(...outgoing.map((link) => link.target));
    }
  }
  const skipped = flow.nodes.filter((node) => !processed.has(node.id)).map((node): WorkflowStep => ({ nodeId: node.id, title: node.operation, result: "رد شد", message: "این نود در شاخهٔ اجراشده قرار نداشت." }));
  run.steps.push(...skipped);
  return run;
}
