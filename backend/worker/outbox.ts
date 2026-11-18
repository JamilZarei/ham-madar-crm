import { z } from "zod";
import { advisory, db, workspace } from "@database/client";
import { DomainError } from "@backend/lib/errors/domain";
import { uuid } from "@backend/lib/validations/common";
import { advanceRun, handleTrigger, scheduleDue } from "@backend/features/automations/engine";

export const jobSchema = z.object({ id: uuid, workspaceId: uuid }).strict();
export type OutboxJob = z.output<typeof jobSchema>;
const payload = z.object({ entityId: uuid });

export async function partitions() {
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('hamsir.worker', 'on', true)`;
    const result: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const rows: { id: string }[] = await tx.workspace.findMany({ where: { deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: "asc" }, take: 100, select: { id: true } });
      result.push(...rows.map(({ id }) => id));
      if (rows.length < 100) return result;
      cursor = rows.at(-1)?.id;
    }
  });
}

export async function reserveWork(workspaceId: string, now = new Date()) {
  return workspace(workspaceId, async (tx) => {
    await scheduleDue(tx, workspaceId, now);
    const old = new Date(now.valueOf() - 45_000);
    const permitted = { workspaceId, completedAt: null, failedAt: null, availableAt: { lte: now }, OR: [{ publishedAt: null }, { publishedAt: { lt: old } }] };
    const rows = await tx.outboxEvent.findMany({ where: permitted, select: { id: true, workspaceId: true }, take: 30, orderBy: [{ availableAt: "asc" }, { id: "asc" }] });
    const claimed: OutboxJob[] = [];
    for (const row of rows) {
      const claim = await tx.outboxEvent.updateMany({ where: { ...permitted, id: row.id }, data: { publishedAt: now } });
      if (claim.count) claimed.push(row);
    }
    return claimed;
  });
}
export async function releasePublication(job: OutboxJob) {
  await workspace(job.workspaceId, async (tx) => {
    await tx.outboxEvent.updateMany({ where: { id: job.id, workspaceId: job.workspaceId, completedAt: null, failedAt: null }, data: { publishedAt: null } });
  });
}

export async function consume(raw: unknown) {
  const { workspaceId, id } = jobSchema.parse(raw);
  try {
    await workspace(workspaceId, async (tx) => {
      await advisory(tx, "outbox:" + id);
      const record = await tx.outboxEvent.findFirst({ where: { workspaceId, id, completedAt: null, failedAt: null, availableAt: { lte: new Date() } } });
      if (!record) return;
      if (record.kind === "workflow_step") await advanceRun(tx, workspaceId, payload.parse(record.payload).entityId);
      else await handleTrigger(tx, workspaceId, record.kind, record.id, record.payload, record.createdAt);
      await tx.outboxEvent.update({ where: { id, workspaceId }, data: { completedAt: new Date(), attemptCount: { increment: 1 } } });
    });
  } catch (error) {
    await workspace(workspaceId, async (tx) => {
      await advisory(tx, "outbox:" + id);
      const record = await tx.outboxEvent.findFirst({ where: { workspaceId, id, completedAt: null, failedAt: null } });
      if (!record) return;
      const tryNo = record.attemptCount + 1;
      const permanent = error instanceof DomainError && error.status >= 400 && error.status < 500;
      const exhausted = permanent || tryNo >= 5;
      await tx.outboxEvent.update({ where: { id, workspaceId }, data: { attemptCount: tryNo, publishedAt: null, availableAt: new Date(Date.now() + Math.min(240_000, 2 ** tryNo * 1_000)), failedAt: exhausted ? new Date() : null } });
      if (!exhausted || record.kind !== "workflow_step") return;
      const runId = payload.parse(record.payload).entityId;
      await advisory(tx, "workflow-run:" + runId);
      const finished = await tx.workflowRun.updateMany({ where: { workspaceId, id: runId, stateCode: "running" }, data: { stateCode: "failed", endedAt: new Date() } });
      if (!finished.count) return;
      const step = await tx.workflowRunStep.findFirst({ where: { workspaceId, runId, outcomeCode: { in: ["pending", "waiting"] } }, orderBy: { sequenceNo: "asc" } });
      if (step) await tx.workflowRunStep.update({ where: { id: step.id, workspaceId }, data: { outcomeCode: "failed", attemptCount: { increment: tryNo }, finishedAt: new Date(), message: (step.message?.split("\n")[0] || "مرحلهٔ اجرا") + "\n" + (permanent ? error.message : "اجرای مرحله پس از تلاش مجدد متوقف شد.") } });
      await tx.workflowRunStep.updateMany({ where: { workspaceId, runId, outcomeCode: { in: ["pending", "waiting"] } }, data: { outcomeCode: "skipped", finishedAt: new Date(), nextAttemptAt: null } });
    });
  }
}
