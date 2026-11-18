import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

const workspaceRoot = resolve(__dirname, "..");
const mode = process.env.CRM_FRONTEND_MODE ?? "combined";
if (mode !== "combined" && mode !== "split") throw new Error("CRM_FRONTEND_MODE must be combined or split.");
if (mode === "combined" && process.env.NODE_ENV === "development") {
  const backendEnv = config({
    path: resolve(workspaceRoot, "backend/.env.development.local"), processEnv: {}, quiet: true,
  }).parsed ?? {};
  for (const key of [
    "DATABASE_URL", "APP_ORIGIN", "OTP_SECRET", "SMS_PROVIDER", "TRUSTED_CLIENT_IP_HEADER",
    "SMS_WEBHOOK_SECRET", "SMS_WEBHOOK_ACCOUNT", "SMS_WEBHOOK_WORKSPACE_ID",
  ]) {
    if (process.env[key] === undefined && backendEnv[key] !== undefined) process.env[key] = backendEnv[key];
  }
}

const nextConfig: NextConfig = {
  trailingSlash: true,
  devIndicators: false,
  agentRules: false,
  distDir: mode === "split" ? ".next-split" : ".next",
  outputFileTracingRoot: workspaceRoot,
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "bullmq", "ioredis"],
  webpack(config) {
    const adapter = mode === "split" ? "remote.ts" : "service.ts";
    config.resolve.alias["@crm-service$"] = resolve(__dirname, "lib/server", adapter);
    return config;
  },
};
export default nextConfig;
