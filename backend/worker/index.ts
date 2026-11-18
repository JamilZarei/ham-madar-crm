import { setTimeout as sleep } from "node:timers/promises";
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { db } from "@database/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { consume, partitions, releasePublication, reserveWork, type OutboxJob } from "./outbox";

if (!["production", "test"].includes(process.env.NODE_ENV ?? "")) {
  config({ path: resolve(__dirname, "../.env.development.local"), quiet: true });
}
const transport = process.env.WORKER_TRANSPORT || "redis";
if (!["redis", "postgres-local"].includes(transport)) throw new Error("Unsupported WORKER_TRANSPORT");
if (transport === "postgres-local" && process.env.NODE_ENV === "production") throw new Error("Production requires Redis/BullMQ");
function connection(url: string | undefined): ConnectionOptions {
  if (!url) throw new Error("REDIS_URL is required");
  const config = new URL(url);
  if (!["redis:", "rediss:"].includes(config.protocol)) throw new Error("REDIS_URL must use Redis");
  return { host: config.hostname, port: Number(config.port || 6379), username: config.username ? decodeURIComponent(config.username) : undefined, password: config.password ? decodeURIComponent(config.password) : undefined, db: Number(config.pathname.slice(1) || 0), ...(config.protocol === "rediss:" ? { tls: {} } : {}), connectTimeout: 3_000 };
}
const queueName = "hamsir-crm";
const redis = transport === "redis" ? connection(process.env.REDIS_URL) : undefined;
const queue = redis ? new Queue<OutboxJob>(queueName, { connection: { ...redis, maxRetriesPerRequest: 1, enableOfflineQueue: false } }) : undefined;
const worker = redis ? new Worker<OutboxJob>(queueName, (job) => consume(job.data), { connection: { ...redis, maxRetriesPerRequest: null }, concurrency: 4 }) : undefined;
queue?.on("error", (error) => console.error("queue", error.name));
worker?.on("error", (error) => console.error("worker", error.name));
worker?.on("failed", (job, error) => console.error("job", job?.id, error.name));
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());
async function cycle() {
  for (const workspaceId of await partitions()) {
    const now = new Date();
    const jobs = await reserveWork(workspaceId, now);
    for (const job of jobs) {
      try {
        if (!queue) await consume(job);
        else await queue.add("outbox", job, { jobId: job.id + "-" + now.valueOf(), attempts: 3, backoff: { type: "exponential", delay: 1_000 }, removeOnComplete: { age: 3600, count: 1000 }, removeOnFail: { age: 86400, count: 1000 } });
      } catch (error) {
        console.error("outbox", job.id, error instanceof Error ? error.name : "error");
        await releasePublication(job);
      }
    }
  }
}
async function start() {
  console.log("CRM worker started using", transport);
  try {
    while (!controller.signal.aborted) {
      try { await cycle(); }
      catch (error) { console.error("worker-cycle", error instanceof Error ? error.name : "error"); }
      await sleep(1500, undefined, { signal: controller.signal }).catch(() => {});
    }
  } finally {
    await worker?.close();
    await queue?.close();
    await db().$disconnect();
  }
}
void start();
