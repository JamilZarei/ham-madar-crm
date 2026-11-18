import { forbidden } from "@backend/lib/errors/domain";

export const grants = {
  "crm.read": "مشاهده",
  "crm.write": "ویرایش",
  "crm.all": "مدیریت رکوردهای تیم",
  "members.manage": "مدیریت کاربران و نقش‌ها",
  "settings.manage": "تنظیمات فضای کاری",
  "sms.send": "ارسال آزمایشی",
  "automation.manage": "مدیریت اتوماسیون",
  "reports.read": "گزارش‌گیری",
  "audit.read": "مشاهدهٔ حسابرسی",
} as const;
export type PermissionCode = keyof typeof grants;
export type Actor = { userId: string; membershipId: string; workspaceId: string; name: string; role: string; grants: ReadonlySet<string> };
export const has = (actor: Actor, code: PermissionCode) => actor.grants.has(code) && (code !== "automation.manage" || actor.grants.has("crm.all"));
export function requirePermission(actor: Actor, code: PermissionCode) {
  if (!has(actor, code)) throw forbidden();
}
export const allRecords = (actor: Actor) => has(actor, "crm.all");
export const ownerFilter = (actor: Actor) => allRecords(actor) ? {} : { ownerMembershipId: actor.membershipId };
export const taskFilter = (actor: Actor) => allRecords(actor) ? {} : { assigneeMembershipId: actor.membershipId };
export const owns = (actor: Actor, owner: string | null) => allRecords(actor) || owner === actor.membershipId;
export const baseRoles: { code: string; name: string; permissions: PermissionCode[] }[] = [
  { code: "system_admin", name: "مدیر سیستم", permissions: Object.keys(grants) as PermissionCode[] },
  { code: "sales_manager", name: "مدیر فروش", permissions: ["crm.read", "crm.write", "crm.all", "sms.send", "automation.manage", "reports.read"] },
  { code: "sales_agent", name: "کارشناس فروش", permissions: ["crm.read", "crm.write"] },
];
