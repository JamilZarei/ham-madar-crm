import { randomUUID } from "node:crypto";
import { z } from "zod";
import { advisory, type Tx } from "@database/client";
import { conflict, forbidden, missing } from "@backend/lib/errors/domain";
import { allRecords, has, grants, requirePermission, type Actor } from "@backend/lib/permissions/policy";
import { audit, type Mutation } from "@backend/features/crm/domain";
import { localPhone, email, phone, required, uuid } from "@backend/lib/validations/common";
import type { Settings } from "@shared/model";
import { otpLifetime } from "@backend/features/auth/otp";
import { smsCredit } from "@backend/features/sms/service";

const permissionCode = z.enum(Object.keys(grants) as [keyof typeof grants, ...(keyof typeof grants)[]]);
const profile = z.object({ name: required().optional(), email: email.optional(), notifications: z.boolean().optional(), taskAlerts: z.boolean().optional(), workspace: required().optional(), smsSender: z.string().regex(/^\d{4,18}$/, "شمارهٔ فرستنده معتبر نیست.").optional(), otpTemplate: required(400).refine((value) => value.includes("{{code}}"), "متغیر کد باید در متن باشد.").optional() }).strict();
export const userChange = z.union([
  z.object({ id: uuid, roleId: uuid }).strict(),
  z.object({ name: required(), email, mobile: phone, roleId: uuid }).strict(),
]);
export const roleChange = z.object({ id: uuid.optional(), name: required(), permissions: z.array(permissionCode).min(1).max(20) });

export async function profileDto(tx: Tx, actor: Actor): Promise<Settings> {
  const workspaceId = actor.workspaceId;
  const canManage = has(actor, "members.manage");
  const [member, team, roles, credit] = await Promise.all([
    tx.membership.findFirstOrThrow({ where: { id: actor.membershipId, workspaceId }, include: { workspace: { include: { settings: true } }, user: { select: { fullName: true, email: true, passwordCredential: { select: { userId: true } } } }, role: { select: { name: true } } } }),
    tx.membership.findMany({ where: { workspaceId, statusCode: { not: "removed" }, ...(canManage || allRecords(actor) ? {} : { id: actor.membershipId }) }, take: 100, orderBy: { createdAt: "asc" }, include: { user: { select: { fullName: true, ...(canManage ? { email: true, mobileE164: true } : {}) } }, role: { select: { id: true, name: true } } } }),
    canManage ? tx.role.findMany({ where: { workspaceId, deletedAt: null }, take: 100, include: { grants: true }, orderBy: { name: "asc" } }) : [],
    has(actor, "sms.send") ? smsCredit(tx, workspaceId) : undefined,
  ]);
  return { name: member.user.fullName, email: member.user.email || "", workspace: member.workspace.name, membershipId: member.id, roleName: member.role.name, grants: (Object.keys(grants) as (keyof typeof grants)[]).filter((permission) => has(actor, permission)),
    notifications: member.notificationsEnabled, taskAlerts: member.taskAlertsEnabled, smsSender: member.workspace.settings?.smsSenderDisplay || "", otpLength: 6, otpResend: otpLifetime,
    otpTemplate: member.workspace.settings?.otpPreviewTemplate, smsCredit: credit, passwordConfigured: !!member.user.passwordCredential,
    users: team.map((entry) => ({ id: entry.id, name: entry.user.fullName, role: entry.role.name, roleId: entry.role.id, email: entry.user.email || "", mobile: entry.user.mobileE164 ? localPhone(entry.user.mobileE164) : "", active: entry.statusCode === "active" })),
    roles: roles.map((role) => ({ id: role.id, name: role.name, permissions: role.grants.map((grant) => grant.permissionCode) })),
    permissionOptions: canManage ? Object.entries(grants).map(([code, label]) => ({ code, label })) : [],
  };
}

export async function updateProfile(ctx: Mutation, raw: unknown) {
  const change = profile.parse(raw);
  const { tx, actor } = ctx;
  if (change.workspace !== undefined || change.smsSender !== undefined || change.otpTemplate !== undefined) requirePermission(actor, "settings.manage");
  if (change.name !== undefined || change.email !== undefined) await tx.userAccount.update({ where: { id: actor.userId }, data: { fullName: change.name, email: change.email } });
  if (change.notifications !== undefined || change.taskAlerts !== undefined) await tx.membership.update({ where: { id: actor.membershipId }, data: { notificationsEnabled: change.notifications, taskAlertsEnabled: change.taskAlerts } });
  if (change.workspace !== undefined) await tx.workspace.update({ where: { id: actor.workspaceId }, data: { name: change.workspace } });
  if (change.smsSender !== undefined || change.otpTemplate !== undefined) {
    const data = { smsSenderDisplay: change.smsSender, otpPreviewTemplate: change.otpTemplate };
    await tx.workspaceSettings.upsert({ where: { workspaceId: actor.workspaceId }, create: { workspaceId: actor.workspaceId, ...data }, update: data });
    await audit(ctx, "sensitive_settings", "workspace", actor.workspaceId);
  }
  return true;
}

function manageRole(actor: Actor, role: { code: string; grants: { permissionCode: string }[] }) {
  if ((role.code === "system_admin" && actor.role !== "system_admin") || role.grants.some(({ permissionCode }) => !actor.grants.has(permissionCode))) throw forbidden();
}

async function retainAdmin(ctx: Mutation, id: string) {
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  const admin = await tx.membership.findFirst({ where: { workspaceId, id, statusCode: "active", role: { code: "system_admin" } } });
  if (!admin) return;
  const count = await tx.membership.count({ where: { workspaceId, statusCode: "active", role: { code: "system_admin" } } });
  if (count <= 1) throw conflict("فضای کاری باید دست‌کم یک مدیر سیستم فعال داشته باشد.");
}
export async function saveMember(ctx: Mutation, raw: unknown) {
  requirePermission(ctx.actor, "members.manage");
  const item = userChange.parse(raw);
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":roles");
  const role = await tx.role.findFirst({ where: { id: item.roleId, workspaceId, deletedAt: null }, include: { grants: true } });
  if (!role) throw missing();
  manageRole(actor, role);
  if ("id" in item) {
    const member = await tx.membership.findFirst({ where: { id: item.id, workspaceId, statusCode: { not: "removed" } }, include: { role: { include: { grants: true } } } });
    if (!member) throw missing();
    manageRole(actor, member.role);
    if (role.code !== "system_admin") await retainAdmin(ctx, item.id);
    await tx.membership.update({ where: { id: item.id, workspaceId }, data: { roleId: role.id } });
    await audit(ctx, "membership_updated", "membership", item.id);
    return item.id;
  }
  const user = await tx.userAccount.upsert({ where: { mobileE164: item.mobile }, create: { mobileE164: item.mobile, fullName: item.name, email: item.email }, update: {}, select: { id: true } });
  const previous = await tx.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, include: { role: { include: { grants: true } } } });
  if (previous && previous.statusCode !== "removed") throw conflict("این حساب از قبل عضو فضای کاری است.");
  if (previous) manageRole(actor, previous.role);
  const member = previous
    ? await tx.membership.update({ where: { id: previous.id, workspaceId }, data: { roleId: role.id, statusCode: "active", sessionsValidAfter: new Date() } })
    : await tx.membership.create({ data: { workspaceId, userId: user.id, roleId: role.id } });
  await audit(ctx, "membership_created", "membership", member.id);
  return member.id;
}
export async function memberState(ctx: Mutation, id: string, state: "active" | "disabled" | "removed") {
  requirePermission(ctx.actor, "members.manage");
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":roles");
  const member = await tx.membership.findFirst({ where: { workspaceId, id, statusCode: { not: "removed" } }, include: { role: { include: { grants: true } } } });
  if (!member) throw missing();
  manageRole(actor, member.role);
  if (state !== "active") await retainAdmin(ctx, id);
  if (member.statusCode === state) return id;
  await tx.membership.update({ where: { id, workspaceId }, data: { statusCode: state, sessionsValidAfter: new Date() } });
  await audit(ctx, "membership_" + state, "membership", id);
  return id;
}
export async function updateRole(ctx: Mutation, raw: unknown) {
  requirePermission(ctx.actor, "members.manage");
  const item = roleChange.parse(raw);
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":roles");
  const role = item.id ? await tx.role.findFirst({ where: { workspaceId, id: item.id, deletedAt: null }, include: { grants: true } }) : null;
  if (item.id && !role) throw missing();
  if (role && !role.code.startsWith("custom-")) throw forbidden();
  if (role) manageRole(actor, role);
  if (item.permissions.some((permission) => !actor.grants.has(permission))) throw forbidden();
  const record = role ? await tx.role.update({ where: { id: role.id, workspaceId }, data: { name: item.name } }) : await tx.role.create({ data: { workspaceId, name: item.name, code: "custom-" + randomUUID() } });
  const codes = [...new Set(item.permissions)];
  await tx.rolePermission.deleteMany({ where: { workspaceId, roleId: record.id, permissionCode: { notIn: codes } } });
  await tx.rolePermission.createMany({ data: codes.map((permissionCode) => ({ workspaceId, roleId: record.id, permissionCode })), skipDuplicates: true });
  await audit(ctx, "role_saved", "role", record.id);
  return record.id;
}
export async function archiveRole(ctx: Mutation, id: string) {
  requirePermission(ctx.actor, "members.manage");
  const { tx, actor } = ctx;
  const workspaceId = actor.workspaceId;
  await advisory(tx, workspaceId + ":roles");
  const role = await tx.role.findFirst({ where: { workspaceId, id, deletedAt: null }, include: { grants: true } });
  if (!role) throw missing();
  manageRole(actor, role);
  if (!role.code.startsWith("custom-")) throw forbidden();
  if (await tx.membership.count({ where: { workspaceId, roleId: id, statusCode: { not: "removed" } } })) throw conflict("ابتدا نقش اعضای مرتبط را تغییر دهید.");
  await tx.role.update({ where: { id, workspaceId }, data: { deletedAt: new Date() } });
  await audit(ctx, "role_archived", "role", id);
  return id;
}
