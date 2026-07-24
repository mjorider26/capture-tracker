import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { calculateReconciliationBalances } from "../src/lib/services/reconciliation-core";
import { requireSafeDemoDatabase } from "./demo-seed-safety";
import { demoMoneyIds } from "./demo-money-baseline";
const prisma = createPrismaClient(requireSafeDemoDatabase());
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main() { const record = await prisma.reconciliation.findFirst({ where: { id: demoMoneyIds.reconciliation, businessId: demoMoneyIds.business }, include: { financialAccount: true, items: { include: { transaction: true } } } }); assert(record && record.status === "DRAFT" && record.version === 1, "Deterministic reconciliation draft is missing."); assert(record.financialAccountId === demoMoneyIds.checking && record.financialAccount.ownership === "BUSINESS", "Reconciliation account scope is invalid."); assert(record.statementOpeningBalance.equals("0.00") && record.statementEndingBalance.equals("3550.00") && record.items.length === 0, "Reconciliation baseline is invalid."); const balance = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, []); assert(balance.calculatedBalance.equals(new Prisma.Decimal(0)) && balance.difference.equals("3550.00"), "Reconciliation calculation is invalid."); assert(await prisma.account.count() === 0, "Credentials must remain absent."); console.log("RECONCILIATION BASELINE VERIFIED: draft=1, items=0, calculated=$0.00, difference=$3550.00"); }
main().catch(() => { console.error("Reconciliation baseline verification failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
