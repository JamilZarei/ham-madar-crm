import { createHash, randomBytes } from "node:crypto";
import { db, workspace, type Tx } from "@database/client";
import { unauthorized } from "@backend/lib/errors/domain";
import { type Actor } from "@backend/lib/permissions/policy";

export const SESSION_SECONDS = 8 * 60 * 60;
export { sessionCookie } from "@shared/session-cookie";
export const sessionOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS });
export const tokenDigest = (value: string) => createHash("sha256").update(value).digest();

export async function issueSession(tx: Tx, userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await tx.authSession.create({ data: { userId, tokenHash: tokenDigest(token), expiresAt: new Date(now.valueOf() + SESSION_SECONDS * 1000) } });
  return token;
}

export async function authenticate(token?: string): Promise<Actor> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized();
  const auth = await db().$transaction(async (tx) => {
    const session = await tx.authSession.findUnique({ where: { tokenHash: tokenDigest(token) }, select: { createdAt: true, expiresAt: true, revokedAt: true, user: { select: { id: true, fullName: true, disabledAt: true } } } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.disabledAt) throw unauthorized();
    await tx.$queryRaw`SELECT set_config('hamsir.user_id', ${session.user.id}, true)`;
    const member = await tx.membership.findFirst({ where: { userId: session.user.id, statusCode: "active" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    if (!member) throw unauthorized();
    return { member, user: session.user, issuedAt: session.createdAt };
  });
  return workspace(auth.member.workspaceId, async (tx) => {
    const member = await tx.membership.findFirst({ where: { id: auth.member.id, userId: auth.user.id, statusCode: "active", workspace: { deletedAt: null }, role: { deletedAt: null } }, select: { id: true, workspaceId: true, sessionsValidAfter: true, role: { select: { code: true, grants: { select: { permissionCode: true } } } } } });
    if (!member || (member.sessionsValidAfter && auth.issuedAt <= member.sessionsValidAfter)) throw unauthorized();
    return { userId: auth.user.id, membershipId: member.id, workspaceId: member.workspaceId, name: auth.user.fullName, role: member.role.code, grants: new Set(member.role.grants.map((grant) => grant.permissionCode)) };
  });
}
export async function revokeSession(token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await db().authSession.updateMany({ where: { tokenHash: tokenDigest(token), revokedAt: null }, data: { revokedAt: new Date() } });
}
