import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { advisory, db, type Tx } from "@database/client";
import { DomainError } from "@backend/lib/errors/domain";
import { phone, uuid } from "@backend/lib/validations/common";
import { digits } from "@shared/utils";
import { loginProvider, mockSmsProvider, type SmsProvider } from "@backend/features/sms/provider";
import { issueSession } from "./session";
import { delayError, fingerprint, hit } from "./throttle";

export const otpLifetime = 120;
const otpError = () => new DomainError("OTP_INVALID", "کد تأیید نامعتبر یا منقضی شده است.", 401);
export const requestOtpSchema = z.object({ mobile: phone }).strict();
export const verifyOtpSchema = z.object({ mobile: phone, challengeId: uuid, code: z.string().transform(digits).pipe(z.string().regex(/^\d{6}$/, "کد باید شش رقم باشد.")) }).strict();
async function eligible(tx: Tx, mobileE164: string) {
  const user = await tx.userAccount.findUnique({ where: { mobileE164 }, select: { id: true, disabledAt: true } });
  if (!user || user.disabledAt) return null;
  await tx.$queryRaw`SELECT set_config('hamsir.user_id', ${user.id}, true)`;
  const member = await tx.membership.findFirst({ where: { userId: user.id, statusCode: "active" }, select: { id: true } });
  return member ? user : null;
}
export async function requestOtp(mobile: string, ip: string, provider: SmsProvider = loginProvider()) {
  const now = new Date();
  const until = new Date(now.valueOf() + otpLifetime * 1000);
  const challengeId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const result = await db().$transaction(async (tx) => {
    const rate = Math.max(await hit(tx, "r:ip:" + ip, now, 600, 40), await hit(tx, "r:phone:" + mobile, now, 600, 5));
    if (rate) return { rate };
    await advisory(tx, "otp:" + mobile);
    const user = await eligible(tx, mobile);
    if (!user) return { rate: 0 };
    const active = await tx.otpChallenge.findFirst({ where: { userId: user.id, consumedAt: null, invalidatedAt: null, resendAfterAt: { gt: now } }, orderBy: { issuedAt: "desc" } });
    if (active) return { rate: 0 };
    await tx.otpChallenge.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
    await tx.otpChallenge.create({ data: { id: challengeId, userId: user.id, codeVerifier: fingerprint(challengeId + ":" + code), issuedAt: now, expiresAt: until, resendAfterAt: until } });
    return { rate: 0, delivered: true };
  });
  if (result.rate) throw delayError(result.rate);
  if (result.delivered) {
    try { await provider.otp(mobile, code); }
    catch {
      await db().otpChallenge.updateMany({ where: { id: challengeId, consumedAt: null }, data: { invalidatedAt: new Date() } });
      throw new DomainError("OTP_UNAVAILABLE", "ارسال کد در این لحظه ممکن نشد.", 503);
    }
  }
  return { challengeId, expiresAt: until.toISOString(), resendAfter: otpLifetime,
    ...(result.delivered && provider === mockSmsProvider && process.env.NODE_ENV === "development" ? { demoCode: code } : {}) };
}
export async function verifyOtp(input: z.output<typeof verifyOtpSchema>, ip: string) {
  const now = new Date();
  const result = await db().$transaction(async (tx) => {
    const rate = Math.max(await hit(tx, "v:ip:" + ip, now, 900, 100), await hit(tx, "v:phone:" + input.mobile, now, 900, 12));
    if (rate) return { rate };
    await advisory(tx, "otp:" + input.mobile);
    const user = await eligible(tx, input.mobile);
    if (!user) return { rate: 0 };
    const challenge = await tx.otpChallenge.findFirst({ where: { id: input.challengeId, userId: user.id, expiresAt: { gt: now }, invalidatedAt: null, consumedAt: null, failedAttempts: { lt: 5 } } });
    if (!challenge) return { rate: 0 };
    if (!timingSafeEqual(Buffer.from(challenge.codeVerifier), fingerprint(challenge.id + ":" + input.code))) {
      await tx.otpChallenge.update({ where: { id: challenge.id }, data: { failedAttempts: { increment: 1 } } });
      return { rate: 0 };
    }
    await tx.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
    return { rate: 0, token: await issueSession(tx, user.id, now) };
  });
  if (result.rate) throw delayError(result.rate);
  if (!result.token) throw otpError();
  return result.token;
}
export function requestAddress(request: Request) {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  return header ? request.headers.get(header)?.split(",")[0].trim().slice(0, 64) || "unknown" : "unknown";
}
