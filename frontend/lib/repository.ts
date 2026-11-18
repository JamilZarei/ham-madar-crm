"use client";

import { createContext, createElement, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { commitCRM } from "@/lib/server/actions";
import { ClientError, request } from "@/lib/client/http";
import type { CRMState, Deal, Workflow, WorkflowRun } from "@shared/model";
import type { Scenario } from "@shared/workflow";

let revision = 0;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function refreshCRM() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
export function useResource<T>(url: string | null, debounce = 0) {
  const version = useSyncExternalStore(subscribe, () => revision, () => 0);
  const [result, setResult] = useState<{ url: string; version: number; data?: T; error?: string }>();
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void request<T>(url, { signal: controller.signal }).then((data) => {
        if (!controller.signal.aborted) setResult({ url, version, data });
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ClientError && error.status === 401) {
          window.location.replace("/login/");
          return;
        }
        setResult({ url, version, error: error instanceof Error ? error.message : "بارگیری اطلاعات انجام نشد." });
      });
    }, debounce);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, version, debounce]);
  const data = result?.url === url ? result.data : undefined;
  const error = result?.url === url ? result.error : undefined;
  return { data, error, result, loading: !!url && (result?.url !== url || result?.version !== version) };
}

const context = createContext<{ state: CRMState | null; error?: string }>({ state: null });
export function CRMProvider({ children }: { children: React.ReactNode }) {
  const section = usePathname().split("/")[1] || "dashboard";
  const query = useSearchParams();
  const selected = query.get("id") || query.get("edit");
  const root = "/api/crm/views/" + section + "/";
  const response = useResource<CRMState>(root + (selected ? "?id=" + encodeURIComponent(selected) : ""));
  const state = response.data ?? (response.result?.url.startsWith(root) ? response.result.data : undefined);
  return createElement(context.Provider, { value: { state: state ?? null, error: response.error } }, children);
}
export const useCRM = () => useContext(context).state;
export const useCRMError = () => useContext(context).error;

export async function mutate<T = unknown>(payload: object): Promise<T> {
  const result = await commitCRM(payload);
  if (!result.ok) {
    if (result.status === 401) window.location.replace("/login/");
    throw new ClientError(result.error.message, result.status, "fields" in result.error ? result.error.fields : undefined);
  }
  refreshCRM();
  return result.value as T;
}
type Collection = "contacts" | "companies" | "leads" | "deals" | "tasks" | "events" | "activities" | "templates" | "workflows" | "sms";
type Data<K extends Collection> = CRMState[K][number];
export const crm = {
  save<K extends Collection>(collection: K, item: Data<K>) {
    if (collection === "workflows") return mutate<{ id: string; rowVersion: number }>({ operation: "workflow", values: item });
    const fields = item as Data<K> & { owner?: string; ownerId?: string; amountToman?: string; value?: number };
    const owner = fields.owner && /^[a-f0-9-]{36}$/i.test(fields.owner) ? fields.owner : fields.ownerId ?? "";
    return mutate<{ id: string; rowVersion: number }>({ operation: "save", collection, item: { ...fields, owner, ...(collection === "deals" ? { amountToman: fields.amountToman ?? String(fields.value) } : {}) } });
  },
  saveDeal(item: Deal) { return crm.save("deals", item); },
  remove(collection: Collection, ids: string[]) { return mutate({ operation: "archive", collection, ids }); },
  convertLead(id: string) { return mutate({ operation: "convertLead", id }); },
  appendNote(collection: "contacts" | "companies", id: string, text: string) { return mutate({ operation: "note", collection, id, text }); },
  settings(values: Partial<CRMState["settings"]>) { return mutate({ operation: "profile", values }); },
  toggleWorkflow(id: string, enabled: boolean) { return mutate({ operation: "workflowState", id, enabled }); },
  testWorkflow(values: Workflow, scenario: Scenario) { return mutate<WorkflowRun>({ operation: "workflowTest", values, scenario }); },
};
