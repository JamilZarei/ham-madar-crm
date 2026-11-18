import { defineConfig } from "prisma/config";
import { loadDatabaseEnv } from "./env";

loadDatabaseEnv();

export default defineConfig({
  schema: "schema.prisma",
  migrations: { path: "migrations", seed: "tsx database/seed.ts" },
  datasource: { url: process.env.DIRECT_URL },
});
