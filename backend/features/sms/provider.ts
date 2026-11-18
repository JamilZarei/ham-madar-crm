import { DomainError } from "@backend/lib/errors/domain";

export type Delivery = "delivered" | "failed" | "submitted";
export interface SmsProvider {
  otp(recipient: string, code: string): Promise<void>;
  send(recipient: string, body: string, idempotencyKey: string): Promise<Delivery>;
}

export const mockSmsProvider: SmsProvider = {
  async otp() {},
  async send(recipient) {
    return recipient.endsWith("0") ? "failed" : recipient.endsWith("9") ? "submitted" : "delivered";
  },
};
export function loginProvider(): SmsProvider {
  if (process.env.NODE_ENV !== "production" && process.env.SMS_PROVIDER === "mock") return mockSmsProvider;
  throw new DomainError("OTP_UNAVAILABLE", "ارسال کد ورود در این محیط فعال نیست.", 503);
}

export function demoLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.SMS_PROVIDER === "mock";
}
