import { readFileSync } from "node:fs";
import { assertCloudMigration, assertFictionalStagingBootstrap } from "../src/lib/cloud/staging-guards";
import { readCloudEnvironment } from "../src/lib/cloud/environment";
import { validateFictionalStagingUrl } from "./smoke-fictional-staging";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const runtime = "postgresql://user:password@ep-example-123-pooler.us-east-2.aws.neon.tech:5432/capture_tracker_staging?sslmode=require";
const direct = "postgresql://user:password@ep-example-123.us-east-2.aws.neon.tech:5432/capture_tracker_staging?sslmode=require";
const staging = { CAPTURE_TRACKER_ENVIRONMENT: "staging", CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare", CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon", CAPTURE_TRACKER_REAL_DATA_APPROVED: "false", CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false", CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false", CAPTURE_TRACKER_DATA_MODE: "fictional", CAPTURE_TRACKER_STAGING_DATABASE_URL: runtime, CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: direct, CAPTURE_TRACKER_STAGING_DATABASE_NAME: "capture_tracker_staging" };
const rejects = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
assert(rejects(() => readCloudEnvironment({ ...staging, DATABASE_URL: "postgresql://x:y@localhost:5432/capture_tracker_staging?sslmode=require" })), "Cloud config must reject local DATABASE_URL fallback.");
assert(rejects(() => assertCloudMigration({ ...staging, CAPTURE_TRACKER_CLOUD_MIGRATION_CONFIRMATION: "CAPTURE_TRACKER_STAGING_MIGRATE", CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: runtime })), "Migration must reject pooled direct URL.");
assert(rejects(() => assertCloudMigration({ ...staging, CAPTURE_TRACKER_CLOUD_MIGRATION_CONFIRMATION: "CAPTURE_TRACKER_STAGING_MIGRATE", CAPTURE_TRACKER_STAGING_DATABASE_URL: direct })), "Migration must reject non-pooled runtime URL.");
assert(rejects(() => assertCloudMigration({ ...staging, CAPTURE_TRACKER_CLOUD_MIGRATION_CONFIRMATION: "wrong" })), "Migration confirmation is required.");
assert(rejects(() => assertFictionalStagingBootstrap(staging, ["node"])), "Bootstrap confirmation is required.");
assert(rejects(() => assertFictionalStagingBootstrap({ ...staging, CAPTURE_TRACKER_REAL_DATA_APPROVED: "true", CAPTURE_TRACKER_FICTIONAL_LOGIN_EMAIL: "preview@capture-tracker.demo", CAPTURE_TRACKER_FICTIONAL_LOGIN_PASSWORD: "fictional-only-password" }, ["node", "BOOTSTRAP_FICTIONAL_STAGING"])), "Bootstrap must reject real data.");
assert(validateFictionalStagingUrl("https://capture-tracker-fictional-staging.example", staging).protocol === "https:", "HTTPS staging URL should be accepted.");
assert(rejects(() => validateFictionalStagingUrl("http://localhost:3000", staging)), "Smoke tooling must reject localhost.");
const migration = readFileSync("scripts/cloud-migrate.ts", "utf8");
const migrationUsesPinnedPrismaCli = migration.includes('new URL("../node_modules/prisma/build/index.js", import.meta.url)');
const migrationUsesDeployOnly = /\[prismaCli, "migrate", "deploy"\]/.test(migration);
const migrationContainsForbiddenOperation = /migrate dev|migrate reset|migrate resolve|db push|seed/.test(migration);
assert(migrationUsesPinnedPrismaCli && migrationUsesDeployOnly && !migrationContainsForbiddenOperation, `Migration command must only deploy migrations (pinnedCli=${migrationUsesPinnedPrismaCli}, deployOnly=${migrationUsesDeployOnly}, forbiddenOperation=${migrationContainsForbiddenOperation}).`);
assert(migration.includes('stdio: "pipe"') && !migration.includes('stdio: "inherit"'), "Migration must not print a database URL or password through child output.");
const bootstrap = readFileSync("scripts/bootstrap-fictional-staging.ts", "utf8");
assert(!/api\/|route\.ts|fetch\(/.test(bootstrap), "Bootstrap must remain CLI-only.");
assert(bootstrap.includes('stdio: "pipe"') && !bootstrap.includes('stdio: "inherit"'), "Bootstrap must not print secure credential input.");
console.log("PHASE 9B GUARDS VERIFIED: cloud migration, bootstrap, URL, and no-fallback synthetic checks passed.");
