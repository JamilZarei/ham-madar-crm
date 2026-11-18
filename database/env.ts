import { config } from "dotenv";
import { join } from "node:path";

export function loadDatabaseEnv() {
  if (process.env.NODE_ENV !== "production") {
    config({ path: join(__dirname, ".env.local"), quiet: true });
  }
}
