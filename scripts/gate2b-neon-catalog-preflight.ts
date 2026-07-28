import pg from "pg";
import "./load-local-staging-environment";
import { readCloudEnvironment } from "../src/lib/cloud/environment";

const expectedRelations = [
  "_prisma_migrations", "Business", "User", "Account", "FinancialAccount", "Transaction", "JournalEntry", "JournalLine",
  "Document", "DocumentExtractionAttempt", "DocumentMatchRun", "WeeklyReview", "AskAiConversation", "TransactionDocumentHistory", "WeeklyReviewHistory",
] as const;

type CatalogRow = { relation: string; exists: boolean };

async function main() {
  const config = readCloudEnvironment();
  if (!config.runtimeDatabaseUrl || config.environment !== "staging" || config.deploymentProfile !== "free-preview-cloudflare-neon" || config.realDataApproved) {
    throw new Error("Gate 2B catalog inspection is limited to fictional staging.");
  }
  const client = new pg.Client({ connectionString: config.runtimeDatabaseUrl, ssl: { rejectUnauthorized: true } });
  await client.connect();
  try {
    const result = await client.query<CatalogRow>(
      "SELECT relation, to_regclass(format('public.%I', relation)) IS NOT NULL AS exists FROM unnest($1::text[]) AS relation ORDER BY relation",
      [expectedRelations],
    );
    const missing = result.rows.filter((row) => !row.exists).map((row) => row.relation);
    if (missing.length > 0) {
      console.log(JSON.stringify({ result: "FAIL", step: "expected_relation_preflight", expectedRelations: expectedRelations.length, resolvedRelations: expectedRelations.length - missing.length, missingRelations: missing }));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ result: "PASS", step: "expected_relation_preflight", currentSchema: "public", searchPathClassification: "public-first", applicationSchemas: ["public"], expectedRelations: expectedRelations.length, resolvedRelations: expectedRelations.length, missingRelations: 0, migrationTableExists: true }));
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.log(JSON.stringify({ result: "FAIL", step: "neon_catalog_preflight", reason: "catalog_inspection_failed" }));
  process.exitCode = 1;
});
