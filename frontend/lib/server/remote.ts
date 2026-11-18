import "server-only";
import { cookies, headers } from "next/headers";
import { sessionCookie } from "@shared/session-cookie";

const unavailable = { code: "BACKEND_UNAVAILABLE", message: "ارتباط با سرور برقرار نشد." };
const noCache = { "cache-control": "private, no-store" };
type Problem = { code: string; message: string; fields?: Record<string, string> };
type BackendResult = { ok: true; value: unknown } | { ok: false; error: Problem };

function backendUrl(path: string, search = "") {
  const origin = URL.parse(process.env.CRM_BACKEND_URL ?? "");
  if (!origin || !["http:", "https:"].includes(origin.protocol) || origin.username ||
    origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("CRM_BACKEND_URL must be an HTTP(S) origin without credentials.");
  }
  origin.pathname = path;
  origin.search = search;
  return origin;
}

function forwardSession(source: Headers, destination: Headers) {
  const name = sessionCookie();
  const token = source.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(name + "="))?.slice(name.length + 1);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) destination.set("cookie", name + "=" + token);
}

async function upstream(path: string, init: RequestInit & { duplex?: "half" }, search = "") {
  return fetch(backendUrl(path, search), {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
    ...init,
  });
}

async function proxy(request: Request) {
  const url = new URL(request.url);
  const outbound = new Headers();
  forwardSession(request.headers, outbound);
  for (const key of ["origin", "content-type", "x-hamsir-timestamp", "x-hamsir-signature"]) {
    const value = request.headers.get(key);
    if (value) outbound.set(key, value);
  }
  try {
    const body = request.method === "POST" ? request.body : null;
    const response = await upstream(url.pathname, {
      method: request.method, headers: outbound, ...(body ? { body, duplex: "half" } : {}),
    }, url.search);
    const publicHeaders = new Headers(noCache);
    for (const key of ["content-type", "retry-after"]) {
      const value = response.headers.get(key);
      if (value) publicHeaders.set(key, value);
    }
    if (/^\/api\/auth\/(?:verify|password|change-password|logout)\/$/.test(url.pathname)) {
      for (const cookie of response.headers.getSetCookie()) {
        if (cookie.startsWith(sessionCookie() + "=")) publicHeaders.append("set-cookie", cookie);
      }
    }
    return new Response(response.body, { status: response.status, headers: publicHeaders });
  } catch {
    return Response.json({ ok: false, error: unavailable }, { status: 502, headers: noCache });
  }
}

export const authRoutes = { GET: proxy, POST: proxy };
export const calendarRoutes = { GET: proxy };
export const operationRoutes = { POST: proxy };
export const recordRoutes = { GET: proxy };
export const reportRoutes = { GET: proxy };
export const searchRoutes = { GET: proxy };
export const viewRoutes = { GET: proxy };
export const smsWebhookRoutes = { POST: proxy };

export async function hasSession() {
  const jar = await cookies();
  const name = sessionCookie();
  const token = jar.get(name)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const response = await upstream("/api/auth/session/", { headers: { cookie: name + "=" + token } });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error(unavailable.message);
  return true;
}

export async function demoLoginEnabled() {
  if (process.env.NODE_ENV !== "development") return false;
  const response = await upstream("/api/auth/capabilities/", {}).catch(() => undefined);
  if (!response?.ok) return false;
  const data = await response.json().catch(() => null);
  return data?.value?.demoLogin === true;
}

export async function commitCRM(payload: unknown) {
  try {
    const incoming = new Headers(await headers());
    const outbound = new Headers({ "content-type": "application/json" });
    forwardSession(incoming, outbound);
    const origin = incoming.get("origin");
    if (origin) outbound.set("origin", origin);
    const response = await upstream("/api/crm/operations/", {
      method: "POST", headers: outbound, body: JSON.stringify(payload),
    });
    const data = await response.json() as BackendResult;
    if (response.ok && data.ok === true) return data;
    if (data.ok === false) return { ...data, status: response.status };
  } catch {
    // A backend failure is returned through the existing mutation error UI.
  }
  return { ok: false as const, status: 502, error: unavailable };
}
