import { spawn } from "node:child_process";
import { readCloudEnvironment } from "../src/lib/cloud/environment";

const config = readCloudEnvironment();
if (config.deploymentProfile === "no-deploy") throw new Error("No deployment profile is selected.");
if (config.deploymentProfile === "free-preview-cloudflare-neon" && config.environment !== "staging") throw new Error("Free preview migrations are staging-only.");
const expected = config.environment === "production" ? "CAPTURE_TRACKER_PRODUCTION_MIGRATE" : "CAPTURE_TRACKER_STAGING_MIGRATE";
if (process.env.CAPTURE_TRACKER_CLOUD_MIGRATION_CONFIRMATION !== expected) throw new Error("Cloud migration confirmation is missing.");

const child = spawn("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: config.migrationDatabaseUrl },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
