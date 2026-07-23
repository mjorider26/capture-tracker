import "dotenv/config";

import { Prisma } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import {
  calculateCashBalance,
  calculateRemainingTaxObligation,
  selectLatestTaxEstimate,
} from "../src/lib/data/today-dashboard-core";
import { requireSafeDemoDatabase } from "./demo-seed-safety";

const businessId = "demo-business-northstar-field-solutions";
const prisma = createPrismaClient(requireSafeDemoDatabase());

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });
  const accounts = await prisma.financialAccount.findMany({
    where: {
      businessId,
      ownership: "BUSINESS",
      type: { in: ["CHECKING", "SAVINGS"] },
      isActive: true,
    },
    include: {
      transactions: {
        where: { status: "APPROVED" },
        select: { amount: true, direction: true, status: true },
      },
    },
  });
  const estimates = await prisma.quarterlyTaxEstimate.findMany({
    where: { businessId, status: { notIn: ["VOIDED", "SUPERSEDED"] } },
    select: {
      id: true,
      taxYear: true,
      quarter: true,
      revisionNumber: true,
      projectedTaxLiability: true,
      withholdingCredits: true,
      priorPayments: true,
    },
  });
  const payments = await prisma.taxPaymentRecord.findMany({
    where: { businessId },
    select: { estimateId: true, amount: true, status: true },
  });
  const review = await prisma.weeklyReview.findFirst({
    where: { businessId },
    include: { tasks: true },
  });
  const entries = await prisma.journalEntry.findMany({
    where: { businessId, status: "POSTED" },
    include: { lines: { include: { ledgerAccount: true } } },
  });
  assert(business, "Today read model cannot resolve the fictional business.");
  const cash = calculateCashBalance(accounts);
  const estimate = selectLatestTaxEstimate(estimates);
  assert(estimate, "Today read model cannot resolve a current tax estimate.");
  const obligation = calculateRemainingTaxObligation(
    estimate,
    payments.filter((payment) => payment.estimateId === estimate.id),
  );
  assert(
    cash.equals(new Prisma.Decimal("3550.00")),
    "Available cash does not match the seeded checking activity.",
  );
  assert(
    obligation.equals(new Prisma.Decimal("1500.00")),
    "Remaining tax obligation does not match the seeded estimate.",
  );
  assert(
    accounts.filter((account) => account.isTaxReserve).length === 0,
    "The seed unexpectedly configures a tax reserve.",
  );
  assert(
    review?.tasks.length === 5,
    "Today read model does not return five weekly-review tasks.",
  );
  assert(
    entries.length === 6 &&
      entries.every(
        (entry) =>
          entry.businessId === businessId &&
          entry.lines.every(
            (line) =>
              line.businessId === businessId &&
              line.ledgerAccount.businessId === businessId,
          ),
      ),
    "Journal-backed Today events are not safely business-scoped.",
  );
  console.log("TODAY DASHBOARD VERIFIED");
  console.log(
    "Values: availableCash=$3,550.00, projectedTaxObligation=$1,500.00, taxReserve=not-configured, weeklyReviewTasks=5, journalEvents=6",
  );
}

main()
  .catch((error: unknown) => {
    console.error("Today dashboard verification failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
