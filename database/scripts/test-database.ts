import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadDatabaseEnv } from "../env";

loadDatabaseEnv();
const runtime = process.env.TEST_DATABASE_URL;
const admin = process.env.TEST_DIRECT_URL;
if (!runtime || !admin) throw new Error("Configure TEST_DATABASE_URL and TEST_DIRECT_URL.");
const targets = [runtime, admin].map((value) => new URL(value));
for (const url of targets) {
  if (url.pathname !== "/hamsir_crm_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Database tests require the isolated local hamsir_crm_test.");
}
if (targets[0].host !== targets[1].host) throw new Error("Test URLs must target the same database instance.");
const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: runtime, DIRECT_URL: admin, OTP_SECRET: randomBytes(32).toString("hex") };
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", "database/prisma.config.ts"],
  ["--import", "tsx", "--test", "tests/database.test.ts"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
