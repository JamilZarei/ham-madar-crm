import { cookies } from "next/headers";
import { z } from "zod";
import { json, originCheck, respond } from "@backend/lib/http";
import { missing } from "@backend/lib/errors/domain";
import { currentActor } from "@backend/lib/auth/next";
import { requestAddress, requestOtp, requestOtpSchema, verifyOtp, verifyOtpSchema } from "@backend/features/auth/otp";
import { revokeSession, sessionCookie, sessionOptions } from "@backend/features/auth/session";
import { demoLoginEnabled, loginProvider } from "@backend/features/sms/provider";
import { changePassword, loginWithPassword, passwordChangeSchema, passwordLoginSchema } from "@backend/features/auth/password";

type Route = { params: Promise<{ operation: string }> };
async function signedIn(token: string) {
  (await cookies()).set(sessionCookie(), token, sessionOptions());
  return { signedIn: true };
}
export async function GET(_request: Request, { params }: Route) {
  return respond(async () => {
    const { operation } = await params;
    if (operation === "capabilities") return { demoLogin: demoLoginEnabled() };
    if (operation !== "session") throw missing();
    const actor = await currentActor();
    return { name: actor.name, workspaceId: actor.workspaceId, role: actor.role };
  });
}
export async function POST(request: Request, { params }: Route) {
  return respond(async (requestId) => {
    originCheck(request);
    const operation = (await params).operation;
    if (operation === "request" || operation === "resend") {
      const { mobile } = requestOtpSchema.parse(await json(request, 1_024));
      return requestOtp(mobile, requestAddress(request));
    }
    if (operation === "verify") {
      loginProvider();
      const input = verifyOtpSchema.parse(await json(request, 1_024));
      return signedIn(await verifyOtp(input, requestAddress(request)));
    }
    if (operation === "password") {
      const input = passwordLoginSchema.parse(await json(request, 4_096));
      return signedIn(await loginWithPassword(input, requestAddress(request)));
    }
    if (operation === "change-password") {
      const actor = await currentActor();
      const token = (await cookies()).get(sessionCookie())?.value;
      const input = passwordChangeSchema.parse(await json(request, 4_096));
      return signedIn(await changePassword(actor, token, input, requestId));
    }
    if (operation === "logout") {
      z.object({}).strict().parse(await json(request, 1_024));
      const jar = await cookies();
      await revokeSession(jar.get(sessionCookie())?.value);
      jar.set(sessionCookie(), "", { ...sessionOptions(), maxAge: 0 });
      return { signedIn: false };
    }
    throw missing();
  });
}
