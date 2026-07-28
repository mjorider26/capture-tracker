import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "./load-local-staging-environment";
import { assertCloudMigration } from "../src/lib/cloud/staging-guards";

const config = assertCloudMigration();

const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const child = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  // This child receives only the direct connection as DATABASE_URL. Never
  // inherit a pooled or local DATABASE_URL as a fallback.
  stdio: "pipe",
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: config.migrationDatabaseUrl },
});
if (child.status !== 0) {
  const output = `${child.stdout ?? ""}\n${child.stderr ?? ""}`;
  const prismaCode = output.match(/\bP\d{4}\b/)?.[0] ?? "NONE";
  console.error(JSON.stringify({ result: "FAIL", stage: "PRISMA_MIGRATE_DEPLOY", prismaCode, exitCode: child.status ?? "NO_EXIT_CODE" }));
  process.exitCode = 1;
} else {
  console.log("Cloud migration deploy completed.");
}
