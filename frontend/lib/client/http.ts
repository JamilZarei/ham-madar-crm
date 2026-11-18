"use client";

export class ClientError extends Error {
  constructor(message: string, readonly status: number, readonly fields?: Record<string, string>) {
    super(message);
    this.name = "ClientError";
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await fetch(path, { cache: "no-store", ...init });
  const data = await result.json().catch(() => null);
  if (!result.ok || !data?.ok) throw new ClientError(data?.error?.message || "ارتباط با سرور برقرار نشد.", result.status, data?.error?.fields);
  return data.value as T;
}
export const post = <T,>(path: string, values: unknown) => request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
