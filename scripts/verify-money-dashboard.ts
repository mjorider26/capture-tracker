import "dotenv/config";

import { Prisma } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { buildMoneySummary } from "../src/lib/data/money-dashboard-core";
import { demoMoneyIds } from "./demo-money-baseline";
import { requireSafeDemoDatabase } from "./demo-seed-safety";

const prisma = createPrismaClient(requireSafeDemoDatabase());

async function verify(): Promise<void> {
  const transactions = await prisma.transaction.findMany({
    where: { businessId: demoMoneyIds.business },
    select: {
      id: true,
      amount: true,
      direction: true,
      intent: true,
      status: true,
      version: true,
      splits: { select: { id: true } },
      journalEntry: { select: { id: true } },
    },
  });
  const pending = transactions.find(
    (transaction) => transaction.id === demoMoneyIds.pendingReview,
  );
  if (
    !pending ||
    pending.intent !== "UNREVIEWED" ||
    pending.status !== "PENDING_REVIEW" ||
    pending.version !== 1 ||
    pending.splits.length !== 0 ||
    pending.journalEntry
  ) {
    throw new Error(
      "The deterministic pending Money transaction is not at its baseline.",
    );
  }
  const summary = buildMoneySummary(transactions);
  if (
    transactions.length !== 9 ||
    summary.awaitingReviewCount !== 1 ||
    summary.mixedCount !== 1
  ) {
    throw new Error("The deterministic Money read model counts are invalid.");
  }
  const pendingAmount = new Prisma.Decimal(pending.amount);
  if (!pendingAmount.equals("125.00"))
    throw new Error("The pending Money amount is invalid.");
  console.log("MONEY DASHBOARD VERIFIED");
  console.log(
    "Counts: transactions=9, pendingReview=1, mixed=1, pendingAmount=$125.00",
  );
}

verify()
  .catch(() => {
    console.error("Money verification failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
