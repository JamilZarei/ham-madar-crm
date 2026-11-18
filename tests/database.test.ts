import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { randomInt, randomUUID as id } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@database/generated/prisma/client";
import { db, workspace } from "@database/client";
import { baseRoles, grants, type Actor } from "@backend/lib/permissions/policy";
import { authenticate, revokeSession, tokenDigest } from "@backend/features/auth/session";
import { requestOtp, verifyOtp } from "@backend/features/auth/otp";
import { changePassword, loginWithPassword } from "@backend/features/auth/password";
import type { SmsProvider } from "@backend/features/sms/provider";
import { mutation } from "@backend/features/crm/mutations";
import { recordPage } from "@backend/features/crm/queries";
import { workspaceView, sections } from "@backend/features/crm/views";
import { listQuery } from "@backend/features/crm/schemas";
import { reports, workspaceDay } from "@backend/features/reports/report";
import { consume, reserveWork } from "@backend/worker/outbox";

for (const variable of ["DATABASE_URL", "DIRECT_URL", "TEST_DATABASE_URL", "TEST_DIRECT_URL"] as const) {
  if (!process.env[variable] || new URL(process.env[variable]!).pathname !== "/hamsir_crm_test") throw new Error("Use the isolated test runner.");
}
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DIRECT_URL! }) });
const contacts = () => "+9891" + randomInt(10_000_000, 100_000_000);
const req = (actor: Actor, payload: object) => mutation(actor, id(), payload);
let teamA: Actor;
let teamB: Actor;
let agentA: Actor;
let aMobile: string;

async function makeWorkspace() {
  const group = await admin.workspace.create({ data: { name: "فضای آزمون" } });
  const actor = async (role: typeof baseRoles[number]) => {
    const phone = contacts();
    const memberRole = await admin.role.create({ data: { workspaceId: group.id, code: role.code, name: role.name } });
    await admin.rolePermission.createMany({ data: role.permissions.map((permissionCode) => ({ workspaceId: group.id, roleId: memberRole.id, permissionCode })) });
    const user = await admin.userAccount.create({ data: { mobileE164: phone, fullName: role.name } });
    const member = await admin.membership.create({ data: { workspaceId: group.id, userId: user.id, roleId: memberRole.id } });
    return { identity: { workspaceId: group.id, userId: user.id, membershipId: member.id, name: user.fullName, role: role.code, grants: new Set<string>(role.permissions) }, phone };
  };
  const manager = await actor(baseRoles[0]);
  const sales = await actor(baseRoles[2]);
  const pipeline = await admin.pipeline.create({ data: { workspaceId: group.id, name: "قیف آزمون", isDefault: true } });
  await admin.pipelineStage.createMany({ data: [
    { workspaceId: group.id, pipelineId: pipeline.id, code: "discovery", name: "شناسایی", kind: "open", sortOrder: 0, defaultProbability: 15 },
    { workspaceId: group.id, pipelineId: pipeline.id, code: "won", name: "موفق", kind: "won", sortOrder: 1, defaultProbability: 100 },
  ] });
  await admin.workspaceSettings.create({ data: { workspaceId: group.id, smsDemoQuota: 100 } });
  return { admin: manager.identity, agent: sales.identity, phone: manager.phone };
}

before(async () => {
  await admin.permission.createMany({ data: Object.entries(grants).map(([code, labelFa]) => ({ code, labelFa })), skipDuplicates: true });
  const [first, second] = await Promise.all([makeWorkspace(), makeWorkspace()]);
  teamA = first.admin;
  agentA = first.agent;
  aMobile = first.phone;
  teamB = second.admin;
});
after(async () => { await db().$disconnect(); await admin.$disconnect(); });

test("all CRM views serialize for privileged and scoped members", async () => {
  for (const actor of [teamA, agentA]) {
    for (const section of sections) {
      try {
        const view = await workspaceView(actor, section);
        assert.doesNotThrow(() => JSON.stringify(view));
      } catch (error) {
        throw new Error(`View ${section} failed`, { cause: error });
      }
    }
  }
});

test("OTP validation, attempt limits, atomic consumption, authentication and revocation", async () => {
  let code = "";
  const provider: SmsProvider = { async otp(_mobile, sent) { code = sent; }, async send() { return "delivered"; } };
  const ip = "test-" + id();
  const first = await requestOtp(aMobile, ip, provider);
  assert.match(code, /^[0-9]{6}$/);
  const wrong = code === "000000" ? "999999" : "000000";
  for (let n = 0; n < 5; n++) await assert.rejects(verifyOtp({ mobile: aMobile, challengeId: first.challengeId, code: wrong }, ip), { code: "OTP_INVALID" });
  await assert.rejects(verifyOtp({ mobile: aMobile, challengeId: first.challengeId, code }, ip), { code: "OTP_INVALID" });
  await admin.otpChallenge.update({ where: { id: first.challengeId }, data: { invalidatedAt: new Date() } });
  const second = await requestOtp(aMobile, ip, provider);
  const outcomes = await Promise.allSettled([verifyOtp({ mobile: aMobile, challengeId: second.challengeId, code }, ip), verifyOtp({ mobile: aMobile, challengeId: second.challengeId, code }, ip)]);
  const passes = outcomes.filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled");
  assert.equal(passes.length, 1);
  const session = await authenticate(passes[0].value);
  assert.equal(session.workspaceId, teamA.workspaceId);
  await revokeSession(passes[0].value);
  await assert.rejects(authenticate(passes[0].value), { code: "UNAUTHENTICATED" });
  for (let n = 0; n < 4; n++) await assert.rejects(verifyOtp({ mobile: aMobile, challengeId: id(), code }, ip), { code: "OTP_INVALID" });
  await assert.rejects(verifyOtp({ mobile: aMobile, challengeId: id(), code }, ip), { code: "RATE_LIMIT" });
});

test("delegated membership managers cannot grant stronger permissions or disable the system administrator", async () => {
  const delegate: Actor = { ...agentA, grants: new Set([...agentA.grants, "members.manage"]) };
  const role = await admin.membership.findUniqueOrThrow({ where: { id: teamA.membershipId }, select: { roleId: true } });
  await assert.rejects(req(delegate, { operation: "member", values: { id: agentA.membershipId, roleId: role.roleId } }), { code: "FORBIDDEN" });
  await assert.rejects(req(delegate, { operation: "memberState", id: teamA.membershipId, state: "disabled" }), { code: "FORBIDDEN" });
  await assert.rejects(req(delegate, { operation: "role", values: { name: "مدیر غیرمجاز", permissions: ["crm.all"] } }), { code: "FORBIDDEN" });
  await assert.rejects(req(teamA, { operation: "memberState", id: teamA.membershipId, state: "disabled" }), { code: "CONFLICT" });
});

test("password enrollment requires a recent session, rotates sessions and the old password stops working", async () => {
  const firstPassword = "فقط برای آزمونِ رمز حساب";
  const nextPassword = "عبارت دوم برای آزمونِ رمز";
  let code = "";
  const provider: SmsProvider = { async otp(_mobile, sent) { code = sent; }, async send() { return "delivered"; } };
  const mobile = (await admin.userAccount.findUniqueOrThrow({ where: { id: teamB.userId }, select: { mobileE164: true } })).mobileE164;
  const ip = "password-test-" + id();
  const challenge = await requestOtp(mobile, ip, provider);
  const original = await verifyOtp({ mobile, challengeId: challenge.challengeId, code }, ip);
  await admin.authSession.update({ where: { tokenHash: tokenDigest(original) }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
  await assert.rejects(changePassword(teamB, original, { password: firstPassword }, id()), { code: "RECENT_LOGIN_REQUIRED" });
  await admin.authSession.update({ where: { tokenHash: tokenDigest(original) }, data: { createdAt: new Date() } });
  const enrolled = await changePassword(teamB, original, { password: firstPassword }, id());
  await assert.rejects(authenticate(original), { code: "UNAUTHENTICATED" });
  assert.equal((await authenticate(enrolled)).userId, teamB.userId);
  const stored = await admin.passwordCredential.findUniqueOrThrow({ where: { userId: teamB.userId } });
  assert.match(stored.hash, /^scrypt-v1\$/);
  assert.ok(!stored.hash.includes(firstPassword));
  const sibling = await loginWithPassword({ mobile, password: firstPassword }, ip);
  await assert.rejects(changePassword(teamB, enrolled, { password: nextPassword }, id()), { code: "CURRENT_PASSWORD_INVALID" });
  const changed = await changePassword(teamB, enrolled, { password: nextPassword, currentPassword: firstPassword }, id());
  await assert.rejects(authenticate(enrolled), { code: "UNAUTHENTICATED" });
  await assert.rejects(authenticate(sibling), { code: "UNAUTHENTICATED" });
  assert.equal((await authenticate(changed)).userId, teamB.userId);
  await assert.rejects(loginWithPassword({ mobile, password: firstPassword }, ip), { code: "PASSWORD_INVALID" });
  assert.equal((await authenticate(await loginWithPassword({ mobile, password: nextPassword }, ip))).userId, teamB.userId);
  for (let n = 0; n < 8; n++) await assert.rejects(loginWithPassword({ mobile: aMobile, password: firstPassword }, ip), { code: "PASSWORD_INVALID" });
  await assert.rejects(loginWithPassword({ mobile: aMobile, password: firstPassword }, ip), { code: "RATE_LIMIT" });
});

test("restoring a membership requires a fresh session", async () => {
  const user = await admin.userAccount.findUniqueOrThrow({ where: { id: agentA.userId }, select: { mobileE164: true } });
  let code = "";
  const provider: SmsProvider = { async otp(_mobile, sent) { code = sent; }, async send() { return "delivered"; } };
  const ip = "test-" + id();
  const challenge = await requestOtp(user.mobileE164, ip, provider);
  const token = await verifyOtp({ mobile: user.mobileE164, challengeId: challenge.challengeId, code }, ip);
  assert.equal((await authenticate(token)).membershipId, agentA.membershipId);
  await req(teamA, { operation: "memberState", id: agentA.membershipId, state: "disabled" });
  await req(teamA, { operation: "memberState", id: agentA.membershipId, state: "active" });
  await assert.rejects(authenticate(token), { code: "UNAUTHENTICATED" });
});

test("CRUD pagination, permission boundary, foreign key workspace and soft deletion", async () => {
  const itemId = id();
  const foreign = id();
  const phone = contacts();
  await req(teamA, { operation: "save", collection: "contacts", item: { id: itemId, name: "نگار آزمون", mobile: phone, status: "فعال", tags: ["اولویت"] } });
  await req(teamB, { operation: "save", collection: "companies", item: { id: foreign, name: "شرکت دوم" } });
  await assert.rejects(req(teamA, { operation: "save", collection: "contacts", item: { id: id(), name: "رابطهٔ خارج از محدوده", mobile: contacts(), status: "فعال", companyId: foreign } }), { code: "NOT_FOUND" });
  await assert.rejects(recordPage(agentA, "contacts", listQuery.parse({}), itemId), { code: "NOT_FOUND" });
  await assert.rejects(req(agentA, { operation: "save", collection: "companies", item: { id: id(), name: "شرکت" } }), { code: "FORBIDDEN" });
  await assert.rejects(workspace(teamA.workspaceId, (tx) => tx.contact.create({ data: { id: id(), workspaceId: teamA.workspaceId, fullName: "رابطه", searchKey: "رابطه", mobileE164: contacts(), statusCode: "active", companyId: foreign } })), { code: "P2003" });
  const isolated = await workspace(teamA.workspaceId, (tx) => tx.company.findUnique({ where: { id: foreign } }));
  assert.equal(isolated, null);
  const result = await recordPage(teamA, "contacts", listQuery.parse({ size: 1, search: "نگار", status: "فعال", sort: "name" }));
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].id, itemId);
  await req(teamA, { operation: "note", collection: "contacts", id: itemId, text: "یادداشت آزمون" });
  await req(teamA, { operation: "archive", collection: "contacts", ids: [itemId] });
  assert.ok(await admin.contact.findFirst({ where: { id: itemId, deletedAt: { not: null } } }));
  assert.equal(await admin.note.count({ where: { contactId: itemId } }), 1);
});

test("lead conversion transaction and Kanban concurrency preserve financial precision", async () => {
  const lead = id();
  const opportunity = id();
  await req(teamA, { operation: "save", collection: "leads", item: { id: lead, name: "سرنخ آزمون", mobile: contacts(), status: "جدید", score: 12 } });
  const converted = await Promise.all([req(teamA, { operation: "convertLead", id: lead }), req(teamA, { operation: "convertLead", id: lead })]);
  assert.equal(converted[0], converted[1]);
  const deal = { id: opportunity, name: "فروش آزمون", stage: "شناسایی", probability: 15, amountToman: "99999999999999999999" };
  await req(teamA, { operation: "save", collection: "deals", item: deal });
  await req(teamA, { operation: "save", collection: "deals", item: { ...deal, rowVersion: 1, stage: "موفق" } });
  await assert.rejects(req(teamA, { operation: "save", collection: "deals", item: { ...deal, rowVersion: 1 } }), { code: "CONFLICT" });
  const record = await admin.deal.findUniqueOrThrow({ where: { id: opportunity } });
  assert.equal(record.amountToman.toFixed(0), deal.amountToman);
  assert.equal(await admin.dealStageChange.count({ where: { dealId: opportunity } }), 2);
  const today = workspaceDay("Asia/Tehran");
  const report = await reports(teamA, { from: today, to: today });
  assert.equal(report.totalToman, deal.amountToman);
});

test("SMS simulation deduplicates batch destinations and replays one persisted result", async () => {
  const actor = teamB;
  const key = id();
  const contactId = id();
  const mobile = contacts();
  await req(actor, { operation: "save", collection: "contacts", item: { id: contactId, name: "مهسا", mobile, status: "فعال" } });
  const values = { key, selected: [contactId, contactId], mobile, text: "سلام {{customer_name}}", type: "اطلاع‌رسانی" };
  const pair = await Promise.all([req(actor, { operation: "sms", values }), req(actor, { operation: "sms", values })]);
  assert.deepEqual(pair[0], pair[1]);
  const messages = await admin.smsMessage.findMany({ where: { workspaceId: actor.workspaceId } });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].renderedBody, "سلام مهسا");
});

test("versioned workflow resumes a delayed node and duplicate delivery creates one effect", async () => {
  const actor = teamB;
  const flow = id(); const trigger = id(); const wait = id(); const act = id();
  const definition = { id: flow, name: "آزمون پردازش", description: "", enabled: true, nodes: [
    { id: trigger, kind: "trigger", operation: "ایجاد مشتری جدید", value: "", position: { x: 0, y: 0 } },
    { id: wait, kind: "delay", operation: "انتظار به دقیقه", value: "1", position: { x: 10, y: 10 } },
    { id: act, kind: "action", operation: "ایجاد وظیفه", value: "وظیفهٔ پایدار", position: { x: 20, y: 20 } },
  ], links: [{ id: id(), source: trigger, target: wait }, { id: id(), source: wait, target: act }] };
  await req(actor, { operation: "workflow", values: definition });
  const customerId = id();
  await req(actor, { operation: "save", collection: "contacts", item: { id: customerId, name: "مشتری گردش کار", mobile: contacts(), status: "فعال" } });
  async function drain() {
    for (let step = 0; step < 20; step++) {
      const jobs = await reserveWork(actor.workspaceId);
      if (!jobs.length) break;
      for (const job of jobs) await Promise.all([consume(job), consume(job)]);
    }
  }
  await drain();
  const waiting = await admin.workflowRunStep.findFirstOrThrow({ where: { workspaceId: actor.workspaceId, nodeId: wait, outcomeCode: "waiting" } });
  const past = new Date(Date.now() - 1_000);
  await admin.workflowRunStep.update({ where: { id: waiting.id }, data: { nextAttemptAt: past } });
  await admin.outboxEvent.updateMany({ where: { workspaceId: actor.workspaceId, eventKey: { endsWith: ":resume:" + waiting.id }, completedAt: null }, data: { availableAt: past } });
  await drain();
  const complete = await admin.workflowRun.findUniqueOrThrow({ where: { id: waiting.runId } });
  assert.equal(complete.stateCode, "succeeded");
  assert.equal(await admin.task.count({ where: { workspaceId: actor.workspaceId, contactId: customerId, name: "وظیفهٔ پایدار" } }), 1);
});

test("the independent worker dispatches scheduled workflows and due task notifications", async () => {
  const actor = teamA;
  const flow = id();
  const trigger = id();
  const action = id();
  const taskId = id();
  await req(actor, { operation: "workflow", values: {
    id: flow, name: "پردازش زمان‌بندی آزمون", description: "", enabled: true, nodes: [
      { id: trigger, kind: "trigger", operation: "زمان‌بندی‌شده", value: "09:30", position: { x: 0, y: 0 } },
      { id: action, kind: "action", operation: "ایجاد اعلان", value: "اعلان زمان‌بندی آزمون", position: { x: 10, y: 10 } },
    ], links: [{ id: id(), source: trigger, target: action }],
  } });
  const scheduled = new Date(Date.now() - 10_000);
  await admin.workflow.update({ where: { id: flow }, data: { nextRunAt: scheduled } });
  await req(actor, { operation: "save", collection: "tasks", item: {
    id: taskId, name: "یادآوری سررسید آزمون", owner: actor.membershipId, priority: "متوسط", status: "باز", due: "2000-01-01",
  } });
  const child = spawn(process.execPath, ["--import", "tsx", "backend/worker/index.ts"], { env: { ...process.env, WORKER_TRANSPORT: "postgres-local" }, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let workerError = "";
  child.stderr?.on("data", (chunk) => { workerError += String(chunk); });
  try {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && child.exitCode === null) {
      const run = await admin.workflowRun.findFirst({ where: { workspaceId: actor.workspaceId, version: { workflowId: flow }, scheduledFor: scheduled, stateCode: "succeeded" } });
      const alert = await admin.notification.findFirst({ where: { workspaceId: actor.workspaceId, reminder: { taskId } } });
      if (run && alert) {
        assert.equal(await admin.workflowRun.count({ where: { workspaceId: actor.workspaceId, version: { workflowId: flow }, scheduledFor: scheduled } }), 1);
        assert.equal(alert.recipientMembershipId, actor.membershipId);
        return;
      }
      await pause(250);
    }
    assert.fail("Worker did not complete scheduled tasks. " + workerError);
  } finally {
    child.kill();
  }
});
