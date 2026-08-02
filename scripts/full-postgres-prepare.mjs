import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  fullPostgresConfig,
  fullPostgresDatabases,
  queryServerIdentity,
  sanitize,
  withClient,
} from "./full-postgres-config.mjs";

const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
const expectedTables = new Set([
  "User",
  "Business",
  "BusinessMember",
  "FinancialAccount",
  "Transaction",
  "TransactionSplit",
  "Document",
  "DocumentStatusHistory",
  "TransactionDocument",
  "TransactionDocumentHistory",
  "DocumentExtractionAttempt",
  "DocumentExtractionCandidate",
  "DocumentExtractionHistory",
  "DocumentMatchRun",
  "DocumentMatchSuggestion",
  "DocumentMatchHistory",
  "AuditEvent",
  "ReimbursementClaim",
  "ReimbursementExpense",
  "PayrollRun",
  "OwnerDistribution",
  "QuarterlyTaxEstimate",
  "TaxPaymentRecord",
  "WeeklyReview",
  "WeeklyReviewHistory",
  "AskAiConversation",
  "AskAiMessage",
  "AskAiRun",
  "AskAiEvidence",
  "AskAiFeedback",
  "AskAiEvent",
  "BusinessOnboarding",
  "BusinessSettings",
  "BusinessSettingsHistory",
  "ExportAudit",
  "ReviewTask",
  "AIRecommendation",
  "ApprovalDecision",
  "LedgerAccount",
  "AccountingPeriod",
  "JournalEntry",
  "JournalLine",
  "PostingRule",
  "Reconciliation",
  "ReconciliationItem",
  "StatementActivity",
  "StatementActivityCandidateDecision",
  "Session",
  "Account",
  "Verification",
  "_prisma_migrations",
]);

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(sanitize(output).slice(-2_000) || "Command failed."),
          ),
    );
  });
}

async function inspectOrCreateDatabase(adminUrl, databaseName) {
  await withClient(adminUrl, async (client) => {
    const databases = await client.query(
      "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
      [[fullPostgresDatabases.validation, fullPostgresDatabases.integration]],
    );
    const exists = databases.rows.some((row) => row.datname === databaseName);
    if (!exists) await client.query(`CREATE DATABASE "${databaseName}"`);
  });
}

async function assertKnownContents(connectionString, databaseName) {
  await withClient(connectionString, async (client) => {
    const schemas = await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' AND nspname <> 'public'",
    );
    if (schemas.rows.length)
      throw new Error(`${databaseName} contains an unexpected schema.`);
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    if (tables.rows.some((row) => !expectedTables.has(row.table_name)))
      throw new Error(`${databaseName} contains an unexpected table.`);
  });
}

async function migrate(connectionString) {
  const env = { ...process.env, DATABASE_URL: connectionString };
  delete env.SHADOW_DATABASE_URL;
  await run(process.execPath, [prismaCli, "migrate", "deploy"], env);
  await run(process.execPath, [prismaCli, "migrate", "status"], env);
}

async function main() {
  const config = fullPostgresConfig();
  const version = await queryServerIdentity(config.adminUrl);
  for (const [databaseName, url] of [
    [fullPostgresDatabases.validation, config.validationUrl],
    [fullPostgresDatabases.integration, config.integrationUrl],
  ]) {
    await inspectOrCreateDatabase(config.adminUrl, databaseName);
    await assertKnownContents(url, databaseName);
    await migrate(url);
    console.log(
      `FULLPG PREPARED: host=${config.host} port=${config.port} version=${version} database=${databaseName}`,
    );
  }
}

main().catch((error) => {
  console.error(
    `Full PostgreSQL preparation failed: ${sanitize(error instanceof Error ? error.message : "unknown error")}`,
  );
  process.exitCode = 1;
});
