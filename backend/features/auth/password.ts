import { z } from "zod";
import { advisory, db, setWorkspace, workspace } from "@database/client";
import { conflict, DomainError, unauthorized } from "@backend/lib/errors/domain";
import { type Actor } from "@backend/lib/permissions/policy";
import { phone } from "@backend/lib/validations/common";
import { hashPassword, newPassword, passwordInput, passwordMatches } from "./password-hash";
import { issueSession, tokenDigest } from "./session";
import { delayError, hit } from "./throttle";

export const passwordLoginSchema = z.object({ mobile: phone, password: passwordInput }).strict();
export const passwordChangeSchema = z.object({ currentPassword: passwordInput.optional(), password: newPassword }).strict();
const badCredentials = () => new DomainError("PASSWORD_INVALID", "شماره موبایل یا رمز عبور نادرست است.", 401);
const accountLock = (userId: string) => "password:" + userId;

export async function loginWithPassword({ mobile, password }: z.output<typeof passwordLoginSchema>, ip: string) {
  const now = new Date();
  const blocked = await db().$transaction(async (tx) => Math.max(
    await hit(tx, "password-login:ip:" + ip, now, 600, 40),
    await hit(tx, "password-login:phone:" + mobile, now, 600, 8),
  ));
  if (blocked) throw delayError(blocked);

  const user = await db().userAccount.findUnique({
    where: { mobileE164: mobile }, select: { id: true, disabledAt: true, passwordCredential: { select: { hash: true } } },
  });
  const hash = user?.passwordCredential?.hash;
  if (!await passwordMatches(password, hash) || !user || user.disabledAt) throw badCredentials();

  return db().$transaction(async (tx) => {
    await advisory(tx, accountLock(user.id));
    const credential = await tx.passwordCredential.findUnique({
      where: { userId: user.id }, select: { hash: true, user: { select: { disabledAt: true } } },
    });
    if (!credential || credential.hash !== hash || credential.user.disabledAt) throw badCredentials();
    await tx.$queryRaw`SELECT set_config('hamsir.user_id', ${user.id}, true)`;
    const member = await tx.membership.findFirst({
      where: { userId: user.id, statusCode: "active" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, workspaceId: true },
    });
    if (!member) throw badCredentials();
    await setWorkspace(tx, member.workspaceId);
    if (!await tx.membership.findFirst({
      where: { id: member.id, statusCode: "active", workspace: { deletedAt: null }, role: { deletedAt: null } }, select: { id: true },
    })) throw badCredentials();
    return issueSession(tx, user.id);
  });
}

export async function changePassword(
  actor: Actor, token: string | undefined, input: z.output<typeof passwordChangeSchema>, requestId: string,
) {
  if (!token) throw unauthorized();
  const digest = tokenDigest(token);
  const now = new Date();
  const blocked = await db().$transaction((tx) => hit(tx, "password-change:" + actor.userId, now, 600, 8));
  if (blocked) throw delayError(blocked);
  const credential = await db().passwordCredential.findUnique({ where: { userId: actor.userId }, select: { hash: true } });
  if (credential && !(input.currentPassword && await passwordMatches(input.currentPassword, credential.hash))) {
    throw new DomainError("CURRENT_PASSWORD_INVALID", "رمز عبور فعلی نادرست است.", 400);
  }
  const hash = await hashPassword(input.password);
  return workspace(actor.workspaceId, async (tx) => {
    await advisory(tx, accountLock(actor.userId));
    const session = await tx.authSession.findUnique({
      where: { tokenHash: digest }, select: { userId: true, revokedAt: true, expiresAt: true, createdAt: true, user: { select: { disabledAt: true } } },
    });
    if (!session || session.userId !== actor.userId || session.revokedAt || session.expiresAt <= new Date() || session.user.disabledAt) {
      throw unauthorized();
    }
    const member = await tx.membership.findFirst({
      where: { id: actor.membershipId, userId: actor.userId, statusCode: "active", workspace: { deletedAt: null }, role: { deletedAt: null } },
      select: { sessionsValidAfter: true },
    });
    if (!member || (member.sessionsValidAfter && session.createdAt <= member.sessionsValidAfter)) throw unauthorized();
    const latest = await tx.passwordCredential.findUnique({ where: { userId: actor.userId }, select: { hash: true } });
    if (latest?.hash !== credential?.hash) throw conflict("رمز عبور تغییر کرده است. دوباره وارد شوید.");
    if (!latest && Date.now() - session.createdAt.getTime() > 10 * 60_000) {
      throw new DomainError("RECENT_LOGIN_REQUIRED", "برای تعیین رمز، دوباره با کد یک‌بارمصرف وارد شوید.", 403);
    }
    await tx.passwordCredential.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId, hash }, update: { hash } });
    const changedAt = new Date();
    await tx.authSession.updateMany({ where: { userId: actor.userId, revokedAt: null }, data: { revokedAt: changedAt } });
    await tx.auditLog.create({ data: {
      workspaceId: actor.workspaceId, actorMembershipId: actor.membershipId, action: "password_changed",
      targetType: "user_account", targetId: actor.userId, requestId, resultCode: "success",
    } });
    return issueSession(tx, actor.userId, changedAt);
  });
}
