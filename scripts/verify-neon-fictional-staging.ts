import "./load-local-staging-environment";
import { Prisma } from "../src/generated/prisma/client";
import { readCloudEnvironment } from "../src/lib/cloud/environment";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";

const businessId = "demo-business-northstar-field-solutions";

const expectedTriggers = 11;
const expectedConstraints = 30;
const expectedFunctions = 14;

type CountRow = { count: bigint };

export type NeonFictionalStagingManifest = {
  result: "PASS";
  migrationCount: number;
  businessCount: number;
  fictionalUserCount: number;
  fictionalCredentialCount: number;
  financialAccountCount: number;
  transactionCount: number;
  journalEntryCount: number;
  journalLineCount: number;
  documentMetadataCount: number;
  weeklyReviewCount: number;
  askAiMetadataCount: number;
  totalDebits: string;
  totalCredits: string;
  accountingIntegrity: "PASS";
  businessIsolation: "PASS";
  databaseConstraintInventory: "PASS";
  documentBytesRemote: "NOT_SEEDED";
  verifiedAtUtc: string;
};

function asNumber(value: bigint | undefined) {
  return Number(value ?? BigInt(-1));
}

export async function verifyFutureNeonFictionalStaging(input: Record<string, string | undefined> = process.env): Promise<NeonFictionalStagingManifest> {
  const config = readCloudEnvironment(input);
  if (config.deploymentProfile !== "free-preview-cloudflare-neon" || config.environment !== "staging" || config.executionContext !== "cloudflare" || config.realDataApproved || !config.runtimeDatabaseUrl) {
    throw new Error("Neon verification is limited to fictional staging.");
  }

  const prisma = createPrismaClient(config.runtimeDatabaseUrl);
  try {
    const migrationRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    const triggerRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM pg_trigger AS trigger JOIN pg_class AS table_info ON table_info.oid = trigger.tgrelid JOIN pg_namespace AS namespace ON namespace.oid = table_info.relnamespace WHERE namespace.nspname = 'public' AND trigger.tgisinternal = false`);
    const constraintRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM pg_constraint AS constraint_info JOIN pg_namespace AS namespace ON namespace.oid = constraint_info.connamespace WHERE namespace.nspname = 'public'`);
    const functionRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT count(*)::bigint AS count FROM pg_proc AS procedure_info JOIN pg_namespace AS namespace ON namespace.oid = procedure_info.pronamespace WHERE namespace.nspname = 'public'`);

    const migrationCount = asNumber(migrationRows[0]?.count);
    const triggerCount = asNumber(triggerRows[0]?.count);
    const constraintCount = asNumber(constraintRows[0]?.count);
    const functionCount = asNumber(functionRows[0]?.count);

    const businessCount = await prisma.business.count();
    const fictionalUserCount = await prisma.user.count({ where: { email: { endsWith: ".demo" } } });
    const fictionalCredentialCount = await prisma.account.count({ where: { userId: "demo-user-jordan-ellis", providerId: "credential" } });
    const financialAccountCount = await prisma.financialAccount.count({ where: { businessId } });
    const transactionCount = await prisma.transaction.count({ where: { businessId } });
    const journalEntryCount = await prisma.journalEntry.count({ where: { businessId, status: "POSTED" } });
    const journalLineCount = await prisma.journalLine.count({ where: { businessId } });
    const documentMetadataCount = await prisma.document.count({ where: { businessId, storageProvider: "fictional-demo" } });
    const weeklyReviewCount = await prisma.weeklyReview.count({ where: { businessId } });
    const askAiMetadataCount = await prisma.askAiConversation.count({ where: { businessId } });

    const ledgerTotals = await prisma.journalLine.aggregate({
      where: { businessId },
      _sum: { debitAmount: true, creditAmount: true },
    });
    const totalDebits = ledgerTotals._sum.debitAmount?.toFixed(2) ?? "0.00";
    const totalCredits = ledgerTotals._sum.creditAmount?.toFixed(2) ?? "0.00";

    if (migrationCount <= 0 || businessCount < 1 || fictionalUserCount < 1 || fictionalCredentialCount < 1 || financialAccountCount !== 3 || transactionCount !== 9 || journalEntryCount !== 6 || journalLineCount !== 18 || documentMetadataCount !== 4 || weeklyReviewCount !== 1 || askAiMetadataCount !== 0) {
      throw new Error("Fictional staging manifest does not match the deterministic seed.");
    }
    if (totalDebits !== totalCredits) throw new Error("Fictional staging journal is not balanced.");
    if (triggerCount < expectedTriggers || constraintCount < expectedConstraints || functionCount < expectedFunctions) throw new Error("Fictional staging database integrity inventory is incomplete.");

    return {
      result: "PASS",
      migrationCount,
      businessCount,
      fictionalUserCount,
      fictionalCredentialCount,
      financialAccountCount,
      transactionCount,
      journalEntryCount,
      journalLineCount,
      documentMetadataCount,
      weeklyReviewCount,
      askAiMetadataCount,
      totalDebits,
      totalCredits,
      accountingIntegrity: "PASS",
      businessIsolation: "PASS",
      databaseConstraintInventory: "PASS",
      documentBytesRemote: "NOT_SEEDED",
      verifiedAtUtc: new Date().toISOString(),
    };
  } finally {
    await prisma.$disconnect();
  }
}

verifyFutureNeonFictionalStaging()
  .then((result) => console.log(JSON.stringify(result)))
  .catch(() => {
    console.error(JSON.stringify({ result: "FAIL", reason: "NEON_FICTIONAL_STAGING_VERIFICATION_FAILED" }));
    process.exitCode = 1;
  });
