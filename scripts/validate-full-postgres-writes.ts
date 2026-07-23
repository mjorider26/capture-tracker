import pg from "pg";

import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import {
  buildMoneySummary,
  serializeMoneyAmount,
} from "../src/lib/data/money-dashboard-core";
import { reviewTransaction } from "../src/lib/services/review-transaction-core";
import { restoreDemoMoneyBaseline } from "./demo-money-baseline";
import { demoMoneyIds } from "./demo-money-baseline";
import {
  fullPostgresConfig,
  requireValidationConfirmation,
} from "./full-postgres-config.mjs";
import { verifyDemoSeed } from "./verify-demo-seed";

const { Client } = pg;
const businessId = demoMoneyIds.business;
const transactionId = demoMoneyIds.pendingReview;
const owner = {
  businessId,
  actorUserId: "demo-user-jordan-ellis",
  actorMembershipId: "demo-membership-jordan-owner",
  role: "OWNER" as const,
  executionMode: "demo" as const,
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertDeferredRollback(
  connectionString: string,
  label: string,
  statements: Array<{ text: string; values?: unknown[] }>,
) {
  const client = new Client({ connectionString });
  await client.connect();
  let rejected = false;
  try {
    await client.query("BEGIN");
    for (const statement of statements)
      await client.query(statement.text, statement.values);
    try {
      await client.query("COMMIT");
    } catch {
      rejected = true;
    }
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
  assert(rejected, `${label} must be rejected at commit.`);
}

async function exerciseMixedReview(
  prisma: ReturnType<typeof createPrismaClient>,
) {
  await restoreDemoMoneyBaseline(prisma);
  const before = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { splits: true, journalEntry: true },
  });
  const auditBefore = await prisma.auditEvent.count({
    where: { businessId, entityId: transactionId },
  });
  assert(
    before.intent === "UNREVIEWED" && before.status === "PENDING_REVIEW",
    "Pending transaction baseline is invalid.",
  );
  assert(
    before.version === 1 && before.splits.length === 0 && !before.journalEntry,
    "Pending transaction must be eligible and unposted.",
  );

  const result = await reviewTransaction(prisma, owner, {
    transactionId,
    expectedVersion: String(before.version),
    intent: "MIXED",
    splits: [
      { intent: "BUSINESS", amount: "75.00", memo: "Fictional field fuel" },
      {
        intent: "PERSONAL",
        amount: "50.00",
        memo: "Fictional personal portion",
      },
    ],
  });
  assert(
    result.ok,
    "Exact mixed review did not commit through the review service.",
  );

  const reviewed = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { splits: { orderBy: { amount: "asc" } }, journalEntry: true },
  });
  const auditAfter = await prisma.auditEvent.findMany({
    where: { businessId, entityId: transactionId },
    orderBy: { occurredAt: "asc" },
  });
  assert(
    reviewed.intent === "MIXED" && reviewed.status === "APPROVED",
    "Mixed review state is invalid.",
  );
  assert(
    reviewed.version === before.version + 1,
    "Mixed review version did not increment exactly once.",
  );
  assert(
    reviewed.splits.length === 2,
    "Mixed review did not create two splits.",
  );
  assert(
    reviewed.splits
      .reduce(
        (total, split) => total.plus(split.amount),
        reviewed.amount.minus(reviewed.amount),
      )
      .equals("125.00"),
    "Mixed splits do not total exactly $125.00.",
  );
  assert(!reviewed.journalEntry, "Review must not create a journal entry.");
  assert(
    auditAfter.length === auditBefore + 1,
    "Mixed review must append exactly one audit event.",
  );
  const appendedAudit = auditAfter[auditAfter.length - 1];
  assert(
    appendedAudit?.beforeJson &&
      appendedAudit.afterJson &&
      appendedAudit.metadataJson,
    "Review audit metadata is incomplete.",
  );

  const moneyRows = await prisma.transaction.findMany({
    where: { businessId },
    select: {
      id: true,
      amount: true,
      direction: true,
      intent: true,
      status: true,
    },
  });
  const moneyRow = moneyRows.find((row) => row.id === transactionId);
  assert(
    moneyRow && serializeMoneyAmount(moneyRow.amount) === "$125.00",
    "Money read serialization is invalid.",
  );
  assert(
    typeof buildMoneySummary(moneyRows).mixedCount === "number",
    "Money read model must not expose Decimal values.",
  );

  for (const expectedVersion of [String(before.version), "99"]) {
    const conflict = await reviewTransaction(prisma, owner, {
      transactionId,
      expectedVersion,
      intent: "BUSINESS",
      splits: [],
    });
    assert(
      !conflict.ok && conflict.code === "CONFLICT",
      "Stale or future version must conflict.",
    );
  }
  const unchanged = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { splits: true },
  });
  const unchangedAudits = await prisma.auditEvent.count({
    where: { businessId, entityId: transactionId },
  });
  assert(
    unchanged.version === reviewed.version &&
      unchanged.splits.length === 2 &&
      unchangedAudits === auditAfter.length,
    "Conflicts must not mutate review state or audit evidence.",
  );

  await restoreDemoMoneyBaseline(prisma);
  await restoreDemoMoneyBaseline(prisma);
  const restoredAudits = await prisma.auditEvent.count({
    where: { businessId, entityId: transactionId },
  });
  assert(
    restoredAudits === auditAfter.length,
    "Baseline restoration must preserve append-only audit evidence.",
  );
  await verifyDemoSeed(prisma);
}

async function main() {
  const config = fullPostgresConfig();
  requireValidationConfirmation();
  const prisma = createPrismaClient(config.validationUrl);
  try {
    await exerciseMixedReview(prisma);
    await exerciseMixedReview(prisma);

    const advisor = await reviewTransaction(
      prisma,
      { ...owner, role: "ADVISOR" },
      { transactionId, expectedVersion: "1", intent: "BUSINESS", splits: [] },
    );
    assert(
      !advisor.ok && advisor.code === "FORBIDDEN",
      "Non-owner review must be rejected.",
    );

    const auditBefore = await prisma.auditEvent.count({
      where: { businessId, entityId: transactionId },
    });
    await assertDeferredRollback(
      config.validationUrl,
      "Invalid transaction split",
      [
        {
          text: 'UPDATE "Transaction" SET "intent" = \'MIXED\' WHERE "id" = $1',
          values: [transactionId],
        },
        {
          text: 'INSERT INTO "TransactionSplit" ("id", "businessId", "transactionId", "intent", "amount", "updatedAt") VALUES ($1, $2, $3, \'BUSINESS\', 124.99, CURRENT_TIMESTAMP)',
          values: ["fullpg-invalid-split", businessId, transactionId],
        },
      ],
    );
    await assertDeferredRollback(
      config.validationUrl,
      "Reimbursement mismatch",
      [
        {
          text: 'UPDATE "ReimbursementClaim" SET "totalAmount" = 299.00 WHERE "id" = $1',
          values: ["demo-reimbursement-claim-july"],
        },
      ],
    );
    await assertDeferredRollback(config.validationUrl, "Journal imbalance", [
      {
        text: 'UPDATE "JournalLine" SET "debitAmount" = 4999.00 WHERE "id" = $1',
        values: ["demo-journal-entry-commission-line-1"],
      },
    ]);
    await assertDeferredRollback(
      config.validationUrl,
      "Accounting period coverage",
      [
        {
          text: 'UPDATE "JournalEntry" SET "entryDate" = \'2026-08-01T12:00:00.000Z\' WHERE "id" = $1',
          values: ["demo-journal-entry-commission"],
        },
      ],
    );
    await assertDeferredRollback(
      config.validationUrl,
      "Locked accounting period",
      [
        {
          text: 'UPDATE "AccountingPeriod" SET "status" = \'LOCKED\' WHERE "id" = $1',
          values: ["demo-accounting-period-july-2026"],
        },
        {
          text: 'UPDATE "JournalEntry" SET "status" = \'POSTED\' WHERE "id" = $1',
          values: ["demo-journal-entry-commission"],
        },
      ],
    );

    const baseline = await prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: { splits: true },
    });
    const auditAfter = await prisma.auditEvent.count({
      where: { businessId, entityId: transactionId },
    });
    assert(
      baseline.version === 1 &&
        baseline.splits.length === 0 &&
        auditBefore === auditAfter,
      "Deferred failures must roll back entirely.",
    );
    await verifyDemoSeed(prisma);
    console.log(
      "FULLPG WRITE VALIDATION PASSED: mixed review committed twice; deferred rollback, audit, concurrency, and restoration verified.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error("Full PostgreSQL write validation failed safely.");
  process.exitCode = 1;
});
