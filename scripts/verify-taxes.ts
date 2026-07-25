import "dotenv/config";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { requireSafeDemoDatabase } from "./demo-seed-safety";
import { demoMoneyIds } from "./demo-money-baseline";

const prisma = createPrismaClient(requireSafeDemoDatabase());

async function main() {
  // Prisma Dev can close a local connection during concurrent read dispatch;
  // run this low-volume baseline check serially. Full PostgreSQL remains the
  // authority for high-risk/concurrency validation.
  const estimate = await prisma.quarterlyTaxEstimate.findUnique({ where: { id: demoMoneyIds.taxEstimate } });
  const payments = await prisma.taxPaymentRecord.count({ where: { businessId: demoMoneyIds.business, estimateId: demoMoneyIds.taxEstimate } });
  const credentials = await prisma.account.count();
  const transactions = await prisma.transaction.count({ where: { businessId: demoMoneyIds.business } });
  const entries = await prisma.journalEntry.count({ where: { businessId: demoMoneyIds.business } });
  const reconciliations = await prisma.reconciliation.count({ where: { businessId: demoMoneyIds.business } });
  const valid = estimate?.recommendedPayment.equals("1500.00") && payments === 0 && credentials === 0 && transactions === 9 && entries === 6 && reconciliations === 1;
  if (!valid) throw new Error(`Tax demo baseline is invalid: estimate=${estimate?.recommendedPayment.toString() ?? "missing"}, payments=${payments}, credentials=${credentials}, transactions=${transactions}, entries=${entries}, reconciliations=${reconciliations}.`);
  console.log("TAXES BASELINE VERIFIED: estimates=1, payments=0, projected=$1500.00, remaining=$1500.00");
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Taxes baseline verification failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
