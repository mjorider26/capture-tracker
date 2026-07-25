import { spawnSync } from "node:child_process";
import { assertCloudMigration } from "../src/lib/cloud/staging-guards";

const config = assertCloudMigration();

const child = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  // This child receives only the direct connection as DATABASE_URL. Never
  // inherit a pooled or local DATABASE_URL as a fallback.
  stdio: "pipe",
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: config.migrationDatabaseUrl },
});
if (child.status !== 0) throw new Error("Cloud migration deploy failed without exposing connection details.");
console.log("Cloud migration deploy completed.");
