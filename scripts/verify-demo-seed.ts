import "dotenv/config";

import { pathToFileURL } from "node:url";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { requireSafeDemoDatabase } from "./demo-seed-safety";

const ids = {
  user: "demo-user-jordan-ellis",
  business: "demo-business-northstar-field-solutions",
  membership: "demo-membership-jordan-owner",
  checking: "demo-financial-account-business-checking",
  creditCard: "demo-financial-account-business-credit-card",
  personalCard: "demo-financial-account-personal-card",
  mixed: "demo-transaction-mixed-purpose",
  claim: "demo-reimbursement-claim-july",
  payroll: "demo-payroll-run-july",
  ownerDistribution: "demo-owner-distribution-july",
  taxEstimate: "demo-quarterly-tax-estimate-q3",
  weeklyReview: "demo-weekly-review-july-20",
  reconciliation: "demo-reconciliation-business-checking-july-2026",
};

const entryIds = [
  "demo-journal-entry-commission",
  "demo-journal-entry-ordinary-expenses",
  "demo-journal-entry-mixed-purpose",
  "demo-journal-entry-reimbursement-accrual",
  "demo-journal-entry-payroll",
  "demo-journal-entry-owner-distribution",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function decimalEquals(left: Prisma.Decimal, right: Prisma.Decimal): boolean {
  return left.equals(right);
}

export async function verifyDemoSeed(client: PrismaClient): Promise<void> {
  const user = await client.user.findUnique({ where: { id: ids.user } });
  const business = await client.business.findUnique({
    where: { id: ids.business },
  });
  const membership = await client.businessMember.findFirst({
    where: { id: ids.membership, businessId: ids.business, userId: ids.user },
  });
  const membershipCount = await client.businessMember.count({
    where: { businessId: ids.business },
  });
  const credentialCount = await client.account.count({
    where: { userId: ids.user },
  });
  const allCredentialCount = await client.account.count();
  const allUserCount = await client.user.count();
  const allBusinessCount = await client.business.count();

  assert(user, "The fictional user is missing.");
  assert(business, "The fictional business is missing.");
  assert(
    user.displayName === "Jordan Ellis",
    "The demo user identity is invalid.",
  );
  assert(
    user.email === "jordan.ellis@northstar.demo",
    "The demo user email is invalid.",
  );
  assert(
    user.email.endsWith(".demo"),
    "The demo user must use a reserved .demo email.",
  );
  assert(
    business.legalName === "Northstar Field Solutions, Inc.",
    "The demo business legal name is invalid.",
  );
  assert(
    business.displayName === "Northstar Field Solutions",
    "The demo business display name is invalid.",
  );
  assert(
    membership?.role === "OWNER",
    "The fictional membership is missing or is not an OWNER membership.",
  );
  assert(
    membershipCount === 1,
    `Expected exactly one business membership, found ${membershipCount}.`,
  );
  assert(
    credentialCount === 0,
    `Expected zero credential accounts, found ${credentialCount}.`,
  );
  assert(
    allCredentialCount === 0,
    `Expected no credential accounts or passwords, found ${allCredentialCount}.`,
  );
  assert(
    allUserCount === 1 && allBusinessCount === 1,
    "Unexpected identity or business records appear in the demo database.",
  );

  const counts = [
    await client.financialAccount.count({
      where: { businessId: ids.business },
    }),
    await client.transaction.count({ where: { businessId: ids.business } }),
    await client.transactionSplit.count({
      where: { businessId: ids.business },
    }),
    await client.reimbursementClaim.count({
      where: { businessId: ids.business },
    }),
    await client.reimbursementExpense.count({
      where: { businessId: ids.business },
    }),
    await client.payrollRun.count({ where: { businessId: ids.business } }),
    await client.ownerDistribution.count({
      where: { businessId: ids.business },
    }),
    await client.quarterlyTaxEstimate.count({
      where: { businessId: ids.business },
    }),
    await client.weeklyReview.count({ where: { businessId: ids.business } }),
    await client.reviewTask.count({ where: { businessId: ids.business } }),
    await client.ledgerAccount.count({ where: { businessId: ids.business } }),
    await client.journalEntry.count({ where: { businessId: ids.business } }),
    await client.journalLine.count({ where: { businessId: ids.business } }),
    await client.accountingPeriod.count({
      where: { businessId: ids.business },
    }),
    await client.reconciliation.count({ where: { businessId: ids.business } }),
  ];
  const expectedCounts = [3, 9, 2, 1, 1, 1, 1, 1, 1, 5, 11, 6, 18, 1, 1];
  const labels = [
    "financial accounts",
    "transactions",
    "transaction splits",
    "reimbursement claims",
    "reimbursement expenses",
    "payroll runs",
    "owner distributions",
    "tax estimates",
    "weekly reviews",
    "review tasks",
    "ledger accounts",
    "journal entries",
    "journal lines",
    "accounting periods",
    "reconciliations",
  ];
  for (const [index, expected] of expectedCounts.entries()) {
    assert(
      counts[index] === expected,
      `Expected ${expected} ${labels[index]}, found ${counts[index]}.`,
    );
  }

  const mixedTransaction = await client.transaction.findUnique({
    where: { id: ids.mixed },
    include: { splits: true },
  });
  assert(
    mixedTransaction?.businessId === ids.business,
    "The mixed transaction is not business-scoped.",
  );
  const splitTotal = mixedTransaction.splits.reduce(
    (total, split) => total.plus(split.amount),
    new Prisma.Decimal(0),
  );
  assert(
    decimalEquals(splitTotal, mixedTransaction.amount),
    "Mixed transaction splits do not equal the parent amount.",
  );

  const reimbursement = await client.reimbursementClaim.findUnique({
    where: { id: ids.claim },
    include: {
      expenses: true,
      paymentTransaction: true,
      reimbursementAccount: true,
    },
  });
  assert(
    reimbursement?.businessId === ids.business,
    "The reimbursement claim is not business-scoped.",
  );
  const reimbursementExpenseTotal = reimbursement.expenses.reduce(
    (total, expense) => total.plus(expense.amount),
    new Prisma.Decimal(0),
  );
  assert(
    decimalEquals(reimbursementExpenseTotal, reimbursement.totalAmount),
    "Reimbursement expenses do not equal the claim total.",
  );
  assert(
    reimbursement.paymentTransaction?.businessId === ids.business,
    "The reimbursement payment crosses business scope.",
  );
  assert(
    reimbursement.reimbursementAccount?.businessId === ids.business,
    "The reimbursement account crosses business scope.",
  );

  const payroll = await client.payrollRun.findUnique({
    where: { id: ids.payroll },
  });
  assert(
    payroll?.businessId === ids.business,
    "The payroll run is not business-scoped.",
  );
  const expectedNetPay = payroll.grossWages
    .minus(payroll.employeeWithholding)
    .minus(payroll.employeePayrollTax)
    .minus(payroll.otherDeductions);
  assert(
    decimalEquals(payroll.netPay, expectedNetPay),
    "Payroll net pay arithmetic is inconsistent.",
  );

  const distribution = await client.ownerDistribution.findUnique({
    where: { id: ids.ownerDistribution },
    include: { transaction: true, sourceAccount: true },
  });
  const estimate = await client.quarterlyTaxEstimate.findUnique({
    where: { id: ids.taxEstimate },
  });
  const review = await client.weeklyReview.findUnique({
    where: { id: ids.weeklyReview },
    include: { tasks: true },
  });
  const financialAccounts = await client.financialAccount.findMany({
    where: { id: { in: [ids.checking, ids.creditCard, ids.personalCard] } },
  });
  const entries = await client.journalEntry.findMany({
    where: { id: { in: entryIds } },
    include: {
      accountingPeriod: true,
      lines: { include: { ledgerAccount: true } },
    },
  });
  assert(
    distribution?.businessId === ids.business,
    "The owner distribution is not business-scoped.",
  );
  assert(
    distribution.transaction?.businessId === ids.business,
    "The owner distribution transaction crosses business scope.",
  );
  assert(
    distribution.sourceAccount.businessId === ids.business,
    "The owner distribution source account crosses business scope.",
  );
  assert(
    estimate?.businessId === ids.business,
    "The quarterly tax estimate is not business-scoped.",
  );
  assert(
    review?.businessId === ids.business && review.tasks.length === 5,
    "The weekly review tasks are incomplete or cross business scope.",
  );
  assert(
    financialAccounts.length === 3 &&
      financialAccounts.every((account) => account.businessId === ids.business),
    "A financial account crosses business scope.",
  );
  assert(
    entries.length === 6,
    `Expected six seeded journal entries, found ${entries.length}.`,
  );

  for (const entry of entries) {
    assert(
      entry.businessId === ids.business,
      `Journal entry ${entry.id} crosses business scope.`,
    );
    assert(
      entry.status === "POSTED",
      `Journal entry ${entry.id} is not posted.`,
    );
    assert(
      entry.accountingPeriod.businessId === ids.business,
      `Journal entry ${entry.id} has a cross-business accounting period.`,
    );
    assert(
      entry.entryDate >= entry.accountingPeriod.startsAt &&
        entry.entryDate <= entry.accountingPeriod.endsAt,
      `Journal entry ${entry.id} falls outside its accounting period.`,
    );
    assert(
      entry.lines.length >= 2 &&
        entry.lines.every(
          (line) =>
            line.businessId === ids.business &&
            line.ledgerAccount.businessId === ids.business,
        ),
      `Journal entry ${entry.id} has a cross-business line relationship.`,
    );
    const debits = entry.lines.reduce(
      (total, line) => total.plus(line.debitAmount),
      new Prisma.Decimal(0),
    );
    const credits = entry.lines.reduce(
      (total, line) => total.plus(line.creditAmount),
      new Prisma.Decimal(0),
    );
    assert(
      decimalEquals(debits, credits),
      `Journal entry ${entry.id} does not balance.`,
    );
  }
  const reconciliation = await client.reconciliation.findFirst({
    where: { id: ids.reconciliation, businessId: ids.business },
    include: { financialAccount: true, items: true },
  });
  assert(reconciliation?.status === "DRAFT" && reconciliation.version === 1, "The deterministic reconciliation draft is invalid.");
  assert(reconciliation.financialAccountId === ids.checking && reconciliation.financialAccount.ownership === "BUSINESS", "The deterministic reconciliation account is invalid.");
  assert(reconciliation.statementOpeningBalance.equals("0.00") && reconciliation.statementEndingBalance.equals("3550.00") && reconciliation.items.length === 0, "The deterministic reconciliation baseline is invalid.");

  const identityText = [
    user.displayName,
    user.email,
    business.legalName,
    business.displayName,
  ]
    .join(" ")
    .toLowerCase();
  assert(
    !identityText.includes("robert"),
    "Robert-related identity data appears in the demo data.",
  );
  assert(
    identityText.includes("jordan ellis") &&
      identityText.includes("northstar field solutions"),
    "The demo data contains an unexpected identity.",
  );

  console.log("DEMO SEED VERIFIED");
  console.log(
    "Counts: users=1, memberships=1, credentials=0, financialAccounts=3, transactions=9, splits=2, reimbursementClaims=1, reimbursementExpenses=1, payrollRuns=1, ownerDistributions=1, taxEstimates=1, weeklyReviews=1, reviewTasks=5, ledgerAccounts=11, journalEntries=6, journalLines=18, accountingPeriods=1, reconciliations=1",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const prisma = createPrismaClient(requireSafeDemoDatabase());
  verifyDemoSeed(prisma)
    .catch((error: unknown) => {
      console.error("Demo seed verification failed.");
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
