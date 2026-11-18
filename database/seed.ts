import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { loadDatabaseEnv } from "./env";
import { baseRoles, grants } from "@backend/lib/permissions/policy";
import { createSeed } from "./demo-data";
import { contactState, leadState, sourceType, stageType, priorityType, taskState, activityType, eventType } from "@shared/codes";
import { dateOnly, localPhone } from "@backend/lib/validations/common";
import { searchText } from "@shared/utils";

function key(value: string) {
  const hex = createHash("sha256").update("hamsir-demo:" + value).digest("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}
const canonical = (value: string) => "+98" + localPhone(value).slice(1);
loadDatabaseEnv();
const isTest = process.argv.includes("--test");
const connectionString = isTest ? process.env.TEST_DIRECT_URL : process.env.DIRECT_URL;
if (!connectionString) throw new Error("Configure the isolated seed datasource.");
const destination = new URL(connectionString);
const expectedDatabase = isTest ? "/hamsir_crm_test" : "/hamsir_crm_dev";
if (process.env.NODE_ENV === "production" || destination.pathname !== expectedDatabase || !["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname)) {
  throw new Error("Demo seed is restricted to the named local development or test database.");
}
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seed() {
  const workspaceId = key("workspace");
  const demo = createSeed();
  await client.$transaction(async (tx) => {
    if (process.argv.includes("--if-empty") && await tx.workspace.count()) return;
    await tx.workspace.upsert({ where: { id: workspaceId }, create: { id: workspaceId, name: "فضای کاری فروش" }, update: {} });
    await tx.workspaceSettings.upsert({ where: { workspaceId }, create: { workspaceId, smsSenderDisplay: "300012345" }, update: {} });
    for (const [code, labelFa] of Object.entries(grants)) {
      await tx.permission.upsert({ where: { code }, create: { code, labelFa }, update: { labelFa } });
    }
    for (const role of baseRoles) {
      const id = key(role.code);
      await tx.role.upsert({ where: { id }, create: { id, workspaceId, code: role.code, name: role.name }, update: {} });
      await tx.rolePermission.createMany({ data: role.permissions.map((permissionCode) => ({ workspaceId, roleId: id, permissionCode })), skipDuplicates: true });
    }
    const owners = new Map<string, string>();
    for (const [index, member] of demo.settings.users.entries()) {
      const mobileE164 = ["+989123456789", "+989123456788", "+989123456787", "+989123456786"][index];
      const roleId = key(baseRoles[Math.min(index, 2)].code);
      const userId = key("user:" + member.id);
      const membershipId = key("member:" + member.id);
      owners.set(member.name, membershipId);
      await tx.userAccount.upsert({ where: { mobileE164 }, create: { id: userId, mobileE164, fullName: member.name, email: member.email }, update: {} });
      await tx.membership.upsert({ where: { id: membershipId }, create: { id: membershipId, workspaceId, userId, roleId }, update: {} });
    }
    if (isTest) return;
    const owner = (name: string) => owners.get(name) ?? [...owners.values()][0];
    const relation = (id: string) => id ? key(id) : null;
    const pipelineId = key("pipeline");
    await tx.pipeline.upsert({ where: { id: pipelineId }, create: { id: pipelineId, workspaceId, name: "قیف فروش", isDefault: true }, update: {} });
    const labels = ["شناسایی", "ارزیابی", "پیشنهاد", "مذاکره", "موفق", "ناموفق"] as const;
    await tx.pipelineStage.createMany({ data: labels.map((name, index) => ({ id: key("stage:" + name), workspaceId, pipelineId, code: stageType.code(name), name, kind: index < 4 ? "open" : index === 4 ? "won" : "lost", sortOrder: index, defaultProbability: [15, 35, 55, 80, 100, 0][index] })), skipDuplicates: true });
    await tx.company.createMany({ data: demo.companies.map((item) => ({ id: key(item.id), workspaceId, name: item.name, searchKey: searchText(item.name + " " + item.industry), industry: item.industry, phone: item.mobile, email: item.email, website: item.website, description: item.description, createdAt: new Date(item.created) })), skipDuplicates: true });
    await tx.contact.createMany({ data: demo.contacts.map((item) => ({ id: key(item.id), workspaceId, fullName: item.name, searchKey: searchText([item.name, item.mobile, item.email].join(" ")), mobileE164: canonical(item.mobile), email: item.email, companyId: relation(item.companyId), jobTitle: item.role, ownerMembershipId: owner(item.owner), statusCode: contactState.code(item.status), sourceCode: sourceType.find(item.source), description: item.description, createdAt: new Date(item.created) })), skipDuplicates: true });
    for (const item of demo.contacts) {
      for (const name of item.tags) {
        const nameKey = searchText(name);
        const tag = await tx.tag.upsert({ where: { workspaceId_nameKey: { workspaceId, nameKey } }, create: { workspaceId, name, nameKey }, update: {} });
        await tx.contactTag.createMany({ data: { workspaceId, contactId: key(item.id), tagId: tag.id }, skipDuplicates: true });
      }
    }
    await tx.lead.createMany({ data: demo.leads.map((item) => ({ id: key(item.id), workspaceId, fullName: item.name, searchKey: searchText([item.name, item.mobile, item.email].join(" ")), mobileE164: canonical(item.mobile), email: item.email, companyId: relation(item.companyId), ownerMembershipId: owner(item.owner), statusCode: leadState.code(item.status === "تبدیل‌شده" ? "واجد شرایط" : item.status), score: item.score, sourceCode: sourceType.find(item.source), lastFollowUpOn: item.followUp ? dateOnly(item.followUp) : null, createdAt: new Date(item.created) })), skipDuplicates: true });
    await tx.deal.createMany({ data: demo.deals.map((item) => ({ id: key(item.id), workspaceId, name: item.name, searchKey: searchText(item.name), companyId: relation(item.companyId), contactId: relation(item.contactId), ownerMembershipId: owner(item.owner), stageId: key("stage:" + item.stage), pipelineId, amountToman: String(item.value), probabilityPct: item.probability, expectedCloseOn: dateOnly(item.close), description: item.description, wonAt: item.stage === "موفق" ? new Date(item.created) : null, createdAt: new Date(item.created) })), skipDuplicates: true });
    await tx.dealStageChange.createMany({ data: demo.deals.map((item) => ({ id: key("move:" + item.id), workspaceId, dealId: key(item.id), toStageId: key("stage:" + item.stage), changedByMembershipId: owner(item.owner), changedAt: new Date(item.created) })), skipDuplicates: true });
    await tx.task.createMany({ data: demo.tasks.map((item) => ({ id: key(item.id), workspaceId, name: item.name, searchKey: searchText(item.name), contactId: relation(item.contactId), assigneeMembershipId: owner(item.owner), priorityCode: priorityType.code(item.priority), statusCode: taskState.code(item.status), dueDate: dateOnly(item.due), completedAt: item.status === "انجام‌شده" ? new Date(item.created) : null, createdAt: new Date(item.created) })), skipDuplicates: true });
    await tx.calendarEvent.createMany({ data: demo.events.map((item) => ({ id: key(item.id), workspaceId, name: item.name, typeCode: eventType.code(item.type), eventDate: dateOnly(item.date), startTime: new Date("1970-01-01T" + item.time + ":00Z"), contactId: relation(item.contactId), createdByMembershipId: owner(demo.settings.name) })), skipDuplicates: true });
    await tx.activity.createMany({ data: demo.activities.map((item) => ({ id: key(item.id), workspaceId, name: item.name, searchKey: searchText(item.name), description: item.description, kindCode: activityType.code(item.type), actorMembershipId: owner(item.owner), contactId: item.contactId ? relation(item.contactId) : null, companyId: item.companyId ? relation(item.companyId) : null, occurredAt: new Date(item.date), isSystem: true })), skipDuplicates: true });
    await tx.smsTemplate.createMany({ data: demo.templates.map((item) => ({ id: key(item.id), workspaceId, name: item.name, bodyTemplate: item.text })), skipDuplicates: true });
    for (const item of demo.workflows) {
      const workflowId = key(item.id);
      const versionId = key(item.id + ":v1");
      await tx.workflow.upsert({ where: { id: workflowId }, create: { id: workflowId, workspaceId, name: item.name, description: item.description, searchKey: searchText(item.name), createdAt: new Date(item.created) }, update: {} });
      await tx.workflowVersion.upsert({ where: { id: versionId }, create: { id: versionId, workspaceId, workflowId, revisionNo: 1, createdByMembershipId: owner(demo.settings.name), triggerCode: item.id === "workflow-1" ? "contact_created" : "lead_created" }, update: {} });
      await tx.workflowVersion.updateMany({ where: { id: versionId, createdByMembershipId: null }, data: { createdByMembershipId: owner(demo.settings.name) } });
      await tx.workflowNode.createMany({ data: item.nodes.map((node) => ({ workspaceId, versionId, nodeId: key(node.id), kind: node.kind, operationCode: node.kind === "trigger" ? item.id === "workflow-1" ? "contact_created" : "lead_created" : item.id === "workflow-1" ? "send_sms" : "create_task", config: { value: node.value }, positionX: node.position.x, positionY: node.position.y })), skipDuplicates: true });
      await tx.workflowEdge.createMany({ data: item.links.map((edge) => ({ id: key(edge.id), workspaceId, versionId, sourceNodeId: key(edge.source), targetNodeId: key(edge.target), branchCode: edge.branch || "next" })), skipDuplicates: true });
      if (item.enabled) await tx.workflow.updateMany({ where: { id: workflowId, rowVersion: 1, activeVersionId: null }, data: { activeVersionId: versionId, rowVersion: 2 } });
    }
  }, { timeout: 30_000 });
}
seed().then(() => console.log("Demo seed ready.")).catch((error) => { console.error("Seed failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => client.$disconnect());
