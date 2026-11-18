import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DomainError, failure, forbidden } from "@backend/lib/errors/domain";

export function originCheck(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_ORIGIN ?? (process.env.NODE_ENV === "production" ? undefined : new URL(request.url).origin);
  const allowed = configured && URL.parse(configured);
  if (!allowed || allowed.origin !== configured ||
    (process.env.NODE_ENV === "production" && allowed.protocol !== "https:") ||
    origin !== allowed.origin) throw forbidden();
}
export async function readJsonBody(request: Request, maxBytes = 128_000): Promise<Buffer> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") throw new DomainError("UNSUPPORTED_MEDIA", "نوع محتوای درخواست معتبر نیست.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("BAD_REQUEST", "درخواست قابل خواندن نیست.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new DomainError("TOO_LARGE", "درخواست بیش از حد بزرگ است.", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function parseJsonBody(raw: Buffer): unknown {
  try { return JSON.parse(raw.toString("utf8")); }
  catch { throw new DomainError("BAD_REQUEST", "درخواست قابل خواندن نیست.", 400); }
}
export async function json(request: Request, maxBytes?: number) { return parseJsonBody(await readJsonBody(request, maxBytes)); }
export async function respond(work: (requestId: string) => Promise<unknown>) {
  const requestId = randomUUID();
  try {
    const value = await work(requestId);
    return value instanceof NextResponse ? value : NextResponse.json({ ok: true, value }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const result = failure(error, requestId);
    const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
    if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status, headers });
  }
}
