"use client";

import { post } from "@/lib/client/http";

const challengeKey = "hamsir-crm.otp.challenge";
export const waitSeconds = 120;
export const iranMobile = /^09[0-9]{9}$/;
type Challenge = { mobile: string; challengeId: string; expiresAt: string; resendAfter: number; demoCode?: string };
export const auth = {
  challenge(): Challenge | null {
    try { return JSON.parse(sessionStorage.getItem(challengeKey) || "null") as Challenge | null; }
    catch { return null; }
  },
  async request(mobile: string, resend = false) {
    const previous = auth.challenge();
    if (!resend && previous?.mobile === mobile && Date.parse(previous.expiresAt) > Date.now()) return previous;
    const data = await post<Omit<Challenge, "mobile">>(resend ? "/api/auth/resend/" : "/api/auth/request/", { mobile });
    const challenge = { ...data, mobile };
    sessionStorage.setItem(challengeKey, JSON.stringify(challenge));
    return challenge;
  },
  async verify(code: string) {
    const challenge = auth.challenge();
    if (!challenge) throw new Error("درخواست کد را دوباره ثبت کنید.");
    await post("/api/auth/verify/", { mobile: challenge.mobile, challengeId: challenge.challengeId, code });
    sessionStorage.removeItem(challengeKey);
  },
  async signInWithPassword(mobile: string, password: string) {
    await post("/api/auth/password/", { mobile, password });
    sessionStorage.removeItem(challengeKey);
  },
  async changePassword(password: string, currentPassword?: string) {
    await post("/api/auth/change-password/", { password, currentPassword });
  },
  async signOut() {
    await post("/api/auth/logout/", {});
    sessionStorage.removeItem(challengeKey);
  },
};
