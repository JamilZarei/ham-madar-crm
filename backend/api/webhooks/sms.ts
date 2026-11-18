import { createHmac, timingSafeEqual } from "node:crypto";
import { advisory, workspace } from "@database/client";
import { DomainError, forbidden } from "@backend/lib/errors/domain";
import { parseJsonBody, readJsonBody, respond } from "@backend/lib/http";
import { uuid } from "@backend/lib/validations/common";
import { statusEventSchema } from "@backend/features/sms/service";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  return respond(async () => {
    const id = uuid.parse((await params).workspaceId);
    const secret = process.env.SMS_WEBHOOK_SECRET;
    const account = process.env.SMS_WEBHOOK_ACCOUNT;
    if (!secret || secret.length < 32 || !account || id !== process.env.SMS_WEBHOOK_WORKSPACE_ID) throw new DomainError("WEBHOOK_DISABLED", "این یکپارچه‌سازی فعال نیست.", 404);
    const epoch = request.headers.get("x-hamsir-timestamp") || "";
    const signature = request.headers.get("x-hamsir-signature") || "";
    if (!/^\d{10}$/.test(epoch) || Math.abs(Date.now() / 1000 - Number(epoch)) > 300 || !/^[a-f0-9]{64}$/i.test(signature)) throw forbidden();
    const raw = await readJsonBody(request, 16_384);
    const expected = createHmac("sha256", secret).update(epoch + ".").update(raw).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw forbidden();
    const input = statusEventSchema.parse(parseJsonBody(raw));
    if (input.account !== account) throw forbidden();
    return workspace(id, async (tx) => {
      const reference = { providerCode: "external", providerAccountRef: account };
      await advisory(tx, "sms-event:" + account + ":" + input.id);
      const duplicate = await tx.smsStatusEvent.findFirst({ where: { workspaceId: id, ...reference, providerEventRef: input.id }, select: { id: true } });
      if (duplicate) return { accepted: true };
      const message = await tx.smsMessage.findFirst({ where: { workspaceId: id, ...reference, providerMessageRef: input.messageRef, send: { modeCode: "live" } } });
      if (!message) return { accepted: true };
      await advisory(tx, id + ":sms-message:" + message.id);
      const locked = await tx.smsMessage.findFirstOrThrow({ where: { id: message.id, workspaceId: id } });
      const statuses = ["queued", "acceptance_unknown", "submitted", "failed", "delivered"];
      if (statuses.indexOf(input.status) > statuses.indexOf(locked.statusCode)) await tx.smsMessage.update({ where: { id: locked.id, workspaceId: id }, data: { statusCode: input.status } });
      await tx.smsStatusEvent.create({ data: { workspaceId: id, messageId: locked.id, statusCode: input.status, providerEventRef: input.id, ...reference } });
      return { accepted: true };
    });
  });
}
