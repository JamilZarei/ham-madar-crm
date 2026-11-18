import { resolve } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  trailingSlash: true,
  devIndicators: false,
  agentRules: false,
  outputFileTracingRoot: resolve(__dirname, ".."),
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default config;
