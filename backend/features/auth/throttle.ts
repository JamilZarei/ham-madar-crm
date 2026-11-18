import { createHmac } from "node:crypto";
import { type Tx } from "@database/client";
import { DomainError } from "@backend/lib/errors/domain";

export function fingerprint(value: string) {
  const secret = process.env.OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("OTP_SECRET is required");
  return createHmac("sha256", secret).update(value).digest();
}

export async function hit(tx: Tx, scope: string, now: Date, windowSeconds: number, limit: number) {
  const bucket = Math.floor(now.valueOf() / (windowSeconds * 1000));
  const expiresAt = new Date((bucket + 1) * windowSeconds * 1000);
  const key = fingerprint(scope + ":" + bucket).toString("hex");
  const row = await tx.authThrottle.upsert({ where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } }, select: { count: true } });
  return row.count > limit ? Math.max(1, Math.ceil((expiresAt.valueOf() - now.valueOf()) / 1000)) : 0;
}

export const delayError = (seconds: number) => new DomainError("RATE_LIMIT", "درخواست‌های زیادی ثبت شده است. کمی بعد دوباره امتحان کنید.", 429, seconds);
