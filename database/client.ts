import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@database/generated/prisma/client";

const globalDb = globalThis as typeof globalThis & { hamsirDb?: PrismaClient };
let singleton: PrismaClient | undefined;
export type Tx = Prisma.TransactionClient;
export function db() {
  if (singleton) return singleton;
  if (process.env.NODE_ENV !== "production" && globalDb.hamsirDb) return globalDb.hamsirDb;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  singleton = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 8, connectionTimeoutMillis: 4_000, idleTimeoutMillis: 20_000 }) });
  if (process.env.NODE_ENV !== "production") globalDb.hamsirDb = singleton;
  return singleton;
}
export async function setWorkspace(tx: Tx, workspaceId: string) {
  await tx.$queryRaw`SELECT set_config('hamsir.workspace_id', ${workspaceId}, true)`;
}
export function workspace<T>(workspaceId: string, work: (tx: Tx) => Promise<T>) {
  return db().$transaction(async (tx) => {
    await setWorkspace(tx, workspaceId);
    return work(tx);
  }, { timeout: 12_000 });
}
export async function advisory(tx: Tx, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
}
