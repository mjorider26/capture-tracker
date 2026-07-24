import "dotenv/config";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { finalizeReconciliation, saveReconciliationSelection } from "../src/lib/services/reconciliation";
import { demoMoneyIds, restoreDemoMoneyBaseline } from "./demo-money-baseline";
import { requireSafeDemoDatabase } from "./demo-seed-safety";
import { verifyDemoSeed } from "./verify-demo-seed";

const prisma = createPrismaClient(requireSafeDemoDatabase());
const actor = { businessId: demoMoneyIds.business, actorUserId: "demo-user-jordan-ellis", actorMembershipId: "demo-membership-jordan-owner", role: "OWNER" as const, executionMode: "demo" as const };
const selected = ["demo-transaction-commission-income", "demo-transaction-internet-service", "demo-transaction-reimbursement-payment", "demo-transaction-owner-distribution"];
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main() {
  await restoreDemoMoneyBaseline(prisma);
  const saved = await saveReconciliationSelection(prisma, actor, { reconciliationId: demoMoneyIds.reconciliation, expectedVersion: "1", transactionIds: selected });
  assert(saved.ok && saved.difference === "0.00" && saved.nextVersion === 2, "Demo draft did not reach exact zero.");
  const stale = await saveReconciliationSelection(prisma, actor, { reconciliationId: demoMoneyIds.reconciliation, expectedVersion: "1", transactionIds: [] });
  assert(!stale.ok && stale.code === "CONFLICT", "Demo stale write was not rejected.");
  const finalized = await finalizeReconciliation(prisma, actor, { reconciliationId: demoMoneyIds.reconciliation, expectedVersion: "2" });
  assert(finalized.ok && finalized.status === "COMPLETED", "Demo reconciliation did not finalize.");
  const immutable = await saveReconciliationSelection(prisma, actor, { reconciliationId: demoMoneyIds.reconciliation, expectedVersion: "3", transactionIds: [] });
  assert(!immutable.ok && immutable.code === "IMMUTABLE", "Completed demo reconciliation was editable.");
  await restoreDemoMoneyBaseline(prisma);
  await restoreDemoMoneyBaseline(prisma);
  await verifyDemoSeed(prisma);
  console.log("DEMO RECONCILIATION EXERCISED: persisted exact zero, stale conflict, immutable finalization, and two restorations verified.");
}
main().catch(() => { console.error("Demo reconciliation exercise failed safely."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
