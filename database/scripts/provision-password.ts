import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { loadDatabaseEnv } from "../env";
import { advisory } from "../client";
import { hashPassword, newPassword } from "@backend/features/auth/password-hash";
import { baseRoles, grants } from "@backend/lib/permissions/policy";
import { phone, required } from "@backend/lib/validations/common";
import { stages } from "@shared/model";
import { stageType } from "@shared/codes";

async function readPassword() {
  if (!process.stdin.isTTY) throw new Error("این فرمان را در ترمینال تعاملی اجرا کنید.");
  const hidden = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const prompt = createInterface({ input: process.stdin, output: hidden, terminal: true });
  const controller = new AbortController();
  prompt.on("SIGINT", () => controller.abort());
  try {
    async function ask(label: string) {
      process.stderr.write(label + " ");
      const answer = await prompt.question("", { signal: controller.signal });
      process.stderr.write("\n");
      return answer;
    }
    const value = newPassword.parse(await ask("رمز عبور"));
    if (value !== await ask("تکرار رمز عبور")) throw new Error("تکرار رمز عبور یکسان نیست.");
    return hashPassword(value);
  } finally {
    prompt.close();
  }
}

async function provision() {
  loadDatabaseEnv();
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error("DIRECT_URL را برای دیتابیس مقصد تعریف کنید.");
  const args = process.argv.slice(2);
  const first = args[0] === "--first-admin";
  if (args.length !== (first ? 4 : 1)) {
    throw new Error('npm run db:provision-password -- MOBILE | --first-admin MOBILE "NAME" "WORKSPACE"');
  }
  const mobileE164 = phone.parse(args[first ? 1 : 0]);
  const fullName = first ? required().parse(args[2]) : "";
  const workspaceName = first ? required().parse(args[3]) : "";
  const destination = new URL(connectionString);
  console.log("دیتابیس مقصد", destination.host + destination.pathname);
  const hash = await readPassword();
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await client.$transaction(async (tx) => {
      if (!first) {
        const user = await tx.userAccount.findFirst({
          where: { mobileE164, disabledAt: null, memberships: { some: { statusCode: "active", workspace: { deletedAt: null }, role: { deletedAt: null } } } },
          select: { id: true },
        });
        if (!user) throw new Error("حساب فعال با این شماره پیدا نشد.");
        await advisory(tx, "password:" + user.id);
        if (await tx.passwordCredential.findUnique({ where: { userId: user.id }, select: { userId: true } })) {
          throw new Error("این حساب قبلاً رمز عبور دارد.");
        }
        await tx.passwordCredential.create({ data: { userId: user.id, hash } });
        return;
      }

      await advisory(tx, "provision:first-admin");
      if (await tx.workspace.count() || await tx.userAccount.count()) throw new Error("ایجاد مدیر اولیه به دیتابیس خالی محدود است.");
      await tx.permission.createMany({ data: Object.entries(grants).map(([code, labelFa]) => ({ code, labelFa })), skipDuplicates: true });
      const { id: workspaceId } = await tx.workspace.create({ data: { name: workspaceName } });
      const { id: userId } = await tx.userAccount.create({ data: { mobileE164, fullName } });
      for (const { code, name, permissions } of baseRoles) {
        const { id: roleId } = await tx.role.create({ data: { workspaceId, code, name } });
        await tx.rolePermission.createMany({ data: permissions.map((permissionCode) => ({ workspaceId, roleId, permissionCode })) });
        if (code === "system_admin") await tx.membership.create({ data: { workspaceId, userId, roleId } });
      }
      await tx.workspaceSettings.create({ data: { workspaceId } });
      const { id: pipelineId } = await tx.pipeline.create({ data: { workspaceId, name: "قیف فروش", isDefault: true } });
      await tx.pipelineStage.createMany({ data: stages.map((name, sortOrder) => ({
        workspaceId, pipelineId, code: stageType.code(name), name, sortOrder,
        kind: sortOrder === 4 ? "won" : sortOrder === 5 ? "lost" : "open",
        defaultProbability: [15, 35, 55, 80, 100, 0][sortOrder],
      })) });
      await tx.passwordCredential.create({ data: { userId, hash } });
    });
    console.log(first ? "مدیر اولیه و فضای کاری ایجاد شدند." : "رمز عبور حساب فعال شد.");
  } finally {
    await client.$disconnect();
  }
}

provision().catch((error: unknown) => {
  console.error(error instanceof Error && (error.constructor === Error || error.name === "ZodError") ? error.message : "ایجاد رمز انجام نشد. اتصال و Migration دیتابیس را بررسی کنید.");
  process.exitCode = 1;
});
