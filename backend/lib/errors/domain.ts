import { z } from "zod";

export class DomainError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly retryAfter?: number) {
    super(message);
    this.name = "DomainError";
  }
}
export const unauthorized = () => new DomainError("UNAUTHENTICATED", "لطفاً وارد حساب شوید.", 401);
export const forbidden = () => new DomainError("FORBIDDEN", "برای این عملیات دسترسی ندارید.", 403);
export const missing = () => new DomainError("NOT_FOUND", "رکورد در دسترس نیست.", 404);
export const conflict = (message: string) => new DomainError("CONFLICT", message, 409);
export const invalid = (message: string) => new DomainError("VALIDATION", message, 422);
export function failure(error: unknown, requestId: string) {
  if (error instanceof DomainError) {
    return { status: error.status, retryAfter: error.retryAfter, error: { code: error.code, message: error.message, requestId } };
  }
  if (error instanceof z.ZodError) {
    const fields = Object.fromEntries(error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return { status: 422, error: { code: "VALIDATION", message: "اطلاعات واردشده معتبر نیست.", fields, requestId } };
  }
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002" || error.code === "23505") return failure(conflict("رکورد تکراری است یا هم‌زمان تغییر کرده است."), requestId);
    if (error.code === "P2025" || error.code === "P2003") return failure(missing(), requestId);
  }
  const errorCode = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9_]{3,20}$/.test(error.code) ? error.code : undefined;
  console.error("crm-request", requestId, error instanceof Error ? error.name : "UnknownError", errorCode);
  return { status: 500, error: { code: "INTERNAL", message: "انجام درخواست ممکن نشد. دوباره تلاش کنید.", requestId } };
}
