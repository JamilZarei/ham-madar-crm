import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { settings: { next: { rootDir: "frontend/" } } },
  globalIgnores(["**/.next/**", "**/.next-split/**", "out/**", ".local/**", "database/generated/**", "**/next-env.d.ts"]),
]);
