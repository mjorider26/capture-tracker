import pg from "pg";

import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import {
  buildMoneySummary,
  serializeMoneyAmount,
} from "../src/lib/data/money-dashboard-core";
import { reviewTransaction } from "../src/lib/services/review-transaction-core";
import {
  finalizeReconciliation,
  saveReconciliationSelection,
} from "../src/lib/services/reconciliation";
import { reverseJournalEntry } from "../src/lib/services/journal-reversal";
import { recordTaxPayment } from "../src/lib/services/tax-payment";
import { restoreDemoMoneyBaseline } from "./demo-money-baseline";
import { demoMoneyIds } from "./demo-money-baseline";
import {
  fullPostgresConfig,
  requireValidationConfirmation,
  sanitize,
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

const reconciliationId = "demo-reconciliation-business-checking-july-2026";
const reconciliationTransactions = [
  "demo-transaction-commission-income",
  "demo-transaction-internet-service",
  "demo-transaction-reimbursement-payment",
  "demo-transaction-owner-distribution",
];

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

async function exerciseReconciliationAndReversal(
  prisma: ReturnType<typeof createPrismaClient>,
) {
  await restoreDemoMoneyBaseline(prisma);
  const auditBefore = await prisma.auditEvent.count({
    where: { businessId, entityId: reconciliationId },
  });
  const draft = await prisma.reconciliation.findUniqueOrThrow({
    where: { id: reconciliationId },
    include: { items: true },
  });
  assert(
    draft.version === 1 && draft.status === "DRAFT" && draft.items.length === 0,
    "Reconciliation baseline must be an empty draft.",
  );
  const rejectedAdvisor = await saveReconciliationSelection(
    prisma,
    { ...owner, role: "ADVISOR" },
    { reconciliationId, expectedVersion: "1", transactionIds: [] },
  );
  assert(
    !rejectedAdvisor.ok && rejectedAdvisor.code === "FORBIDDEN",
    "Advisor reconciliation write must fail.",
  );
  const saved = await saveReconciliationSelection(prisma, owner, {
    reconciliationId,
    expectedVersion: "1",
    transactionIds: reconciliationTransactions,
  });
  assert(
    saved.ok && saved.difference === "0.00" && saved.nextVersion === 2,
    "Exact draft reconciliation selection must commit.",
  );
  const stale = await saveReconciliationSelection(prisma, owner, {
    reconciliationId,
    expectedVersion: "1",
    transactionIds: [],
  });
  assert(
    !stale.ok && stale.code === "CONFLICT",
    "Stale reconciliation selection must conflict.",
  );
  const finalized = await finalizeReconciliation(prisma, owner, {
    reconciliationId,
    expectedVersion: "2",
  });
  assert(
    finalized.ok &&
      finalized.status === "COMPLETED" &&
      finalized.nextVersion === 3,
    "Exact-zero reconciliation must finalize.",
  );
  const immutable = await saveReconciliationSelection(prisma, owner, {
    reconciliationId,
    expectedVersion: "3",
    transactionIds: [],
  });
  assert(
    !immutable.ok && immutable.code === "IMMUTABLE",
    "Completed reconciliation must be immutable.",
  );
  const auditAfter = await prisma.auditEvent.count({
    where: { businessId, entityId: reconciliationId },
  });
  assert(
    auditAfter === auditBefore + 2,
    "Reconciliation success must append exactly one audit per mutation.",
  );
  await restoreDemoMoneyBaseline(prisma);
  await restoreDemoMoneyBaseline(prisma);

  const originalId = "demo-journal-entry-commission";
  const original = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: originalId },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  });
  const reversalAuditBefore = await prisma.auditEvent.count({
    where: { businessId, entityId: originalId },
  });
  const attempts = await Promise.all([
    reverseJournalEntry(prisma, owner, {
      journalEntryId: originalId,
      expectedVersion: String(original.version),
      reversalDate: "2026-07-20",
      reason: "Validation correction one",
    }),
    reverseJournalEntry(prisma, owner, {
      journalEntryId: originalId,
      expectedVersion: String(original.version),
      reversalDate: "2026-07-20",
      reason: "Validation correction two",
    }),
  ]);
  const successes = attempts.filter((result) => result.ok);
  assert(
    successes.length === 1,
    "Exactly one concurrent reversal attempt must succeed.",
  );
  const reversalId = successes[0]!.reversalEntryId;
  const reversal = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: reversalId },
    include: {
      lines: { orderBy: { lineNumber: "asc" } },
      reversalOfEntry: true,
    },
  });
  assert(
    reversal.reversalOfEntryId === originalId && reversal.status === "POSTED",
    "Reversal relation or posting state is invalid.",
  );
  assert(
    reversal.lines.length === original.lines.length &&
      reversal.lines.every(
        (line, index) =>
          line.debitAmount.equals(original.lines[index]!.creditAmount) &&
          line.creditAmount.equals(original.lines[index]!.debitAmount),
      ),
    "Reversal lines must be exact inversions.",
  );
  const originalAfter = await prisma.journalEntry.findUniqueOrThrow({
    where: { id: originalId },
    include: { lines: true },
  });
  assert(
    originalAfter.status === "POSTED" &&
      originalAfter.lines.length === original.lines.length,
    "Original journal history must remain unchanged.",
  );
  const second = await reverseJournalEntry(prisma, owner, {
    journalEntryId: originalId,
    expectedVersion: String(originalAfter.version),
    reversalDate: "2026-07-20",
    reason: "Duplicate attempt",
  });
  assert(
    !second.ok && second.code === "CONFLICT",
    "Sequential duplicate reversal must fail.",
  );
  const reversalAuditAfter = await prisma.auditEvent.count({
    where: { businessId, entityId: reversalId },
  });
  assert(
    reversalAuditAfter === 1 &&
      reversalAuditBefore ===
        (await prisma.auditEvent.count({
          where: { businessId, entityId: originalId },
        })),
    "Reversal audit must be atomic and failures must add none.",
  );
  // This cleanup touches only the disposable validation fixture and leaves audit evidence append-only.
  // Deferred parent-line triggers require a two-stage cleanup: first move the
  // disposable lines to their still-present original, then remove them.
  await prisma.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id: reversalId },
      data: {
        status: "DRAFT",
        reversalOfEntryId: null,
        entryNumber: "VALIDATION-ARCHIVE-REVERSAL",
      },
    });
    await tx.$executeRaw`
      UPDATE "JournalLine"
      SET "journalEntryId" = ${originalId}, "lineNumber" = "lineNumber" + 100
      WHERE "businessId" = ${businessId} AND "journalEntryId" = ${reversalId}
    `;
  });
  await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({
      where: {
        businessId,
        journalEntryId: originalId,
        lineNumber: { gte: 100 },
      },
    });
    await tx.journalEntry.delete({ where: { id: reversalId } });
    await tx.journalEntry.update({
      where: { id: originalId },
      data: { version: original.version },
    });
  });
  await verifyDemoSeed(prisma);
}

async function exerciseTaxPayment(
  prisma: ReturnType<typeof createPrismaClient>,
) {
  await restoreDemoMoneyBaseline(prisma);
  const estimateId = "demo-quarterly-tax-estimate-q3";
  const [
    estimate,
    transactionCount,
    journalCount,
    payrollCount,
    distributionCount,
  ] = await Promise.all([
    prisma.quarterlyTaxEstimate.findUniqueOrThrow({
      where: { id: estimateId },
    }),
    prisma.transaction.count({ where: { businessId } }),
    prisma.journalEntry.count({ where: { businessId } }),
    prisma.payrollRun.count({ where: { businessId, status: "PROCESSED" } }),
    prisma.ownerDistribution.count({ where: { businessId, status: "PAID" } }),
  ]);
  const key = "11111111-1111-4111-8111-111111111111";
  const input = {
    estimateId,
    expectedVersion: String(estimate.version),
    amount: "125.00",
    paidAt: "2026-08-01",
    notes: "Fictional external payment record",
    idempotencyKey: key,
  };
  const auditBefore = await prisma.auditEvent.count({
    where: { businessId, entityType: "TaxPaymentRecord" },
  });
  const [left, right] = await Promise.all([
    recordTaxPayment(prisma, owner, input),
    recordTaxPayment(prisma, owner, input),
  ]);
  assert(
    [left, right].filter((result) => result.ok && result.code === "CREATED")
      .length === 1,
    "One concurrent payment must be created.",
  );
  assert(
    [left, right].filter(
      (result) => result.ok && result.code === "ALREADY_RECORDED",
    ).length === 1,
    "One concurrent payment must replay safely.",
  );
  const payments = await prisma.taxPaymentRecord.findMany({
    where: { businessId, estimateId, idempotencyKey: key },
  });
  const after = await prisma.quarterlyTaxEstimate.findUniqueOrThrow({
    where: { id: estimateId },
  });
  const auditAfter = await prisma.auditEvent.count({
    where: { businessId, entityType: "TaxPaymentRecord" },
  });
  assert(
    payments.length === 1 &&
      payments[0]!.amount.equals("125.00") &&
      after.version === estimate.version + 1 &&
      auditAfter === auditBefore + 1,
    "Tax payment, version, and audit must each persist exactly once.",
  );
  assert(
    (await prisma.transaction.count({ where: { businessId } })) ===
      transactionCount &&
      (await prisma.journalEntry.count({ where: { businessId } })) ===
        journalCount &&
      (await prisma.payrollRun.count({
        where: { businessId, status: "PROCESSED" },
      })) === payrollCount &&
      (await prisma.ownerDistribution.count({
        where: { businessId, status: "PAID" },
      })) === distributionCount,
    "Tax payment must not create or alter transactions, journals, payroll, or distributions.",
  );
  const replay = await recordTaxPayment(prisma, owner, input);
  assert(
    replay.ok && replay.code === "ALREADY_RECORDED",
    "Exact replay must return ALREADY_RECORDED.",
  );
  assert(
    (await prisma.taxPaymentRecord.count({
      where: { businessId, estimateId, idempotencyKey: key },
    })) === 1 &&
      (
        await prisma.quarterlyTaxEstimate.findUniqueOrThrow({
          where: { id: estimateId },
        })
      ).version === after.version &&
      (await prisma.auditEvent.count({
        where: { businessId, entityType: "TaxPaymentRecord" },
      })) === auditAfter,
    "Exact replay must not add a payment, version increment, or audit event.",
  );
  const mismatch = await recordTaxPayment(prisma, owner, {
    ...input,
    amount: "126.00",
  });
  assert(
    !mismatch.ok && mismatch.code === "IDEMPOTENCY_CONFLICT",
    "Mismatched idempotency replay must conflict.",
  );
  assert(
    (await prisma.taxPaymentRecord.count({
      where: { businessId, estimateId, idempotencyKey: key },
    })) === 1 &&
      (await prisma.auditEvent.count({
        where: { businessId, entityType: "TaxPaymentRecord" },
      })) === auditAfter,
    "Mismatched idempotency replay must make no mutation.",
  );
  for (const [freshKey, expectedVersion, expectedCode] of [
    [
      "22222222-2222-4222-8222-222222222222",
      String(estimate.version),
      "STALE_VERSION",
    ],
    ["33333333-3333-4333-8333-333333333333", "99", "FUTURE_VERSION"],
  ] as const) {
    const failed = await recordTaxPayment(prisma, owner, {
      ...input,
      idempotencyKey: freshKey,
      expectedVersion,
    });
    assert(
      !failed.ok && failed.code === expectedCode,
      "Stale and future versions must be distinguished.",
    );
    assert(
      (await prisma.taxPaymentRecord.count({
        where: { businessId, estimateId, idempotencyKey: freshKey },
      })) === 0,
      "Failed version gate must roll back its inserted payment.",
    );
  }
  assert(
    (await prisma.auditEvent.count({
      where: { businessId, entityType: "TaxPaymentRecord" },
    })) === auditAfter,
    "Version conflicts must add no audit evidence.",
  );
  await restoreDemoMoneyBaseline(prisma);
  await restoreDemoMoneyBaseline(prisma);
  const restored = await prisma.quarterlyTaxEstimate.findUniqueOrThrow({
    where: { id: estimateId },
  });
  assert(
    restored.version === estimate.version &&
      (await prisma.taxPaymentRecord.count({
        where: { businessId, estimateId },
      })) === 0,
    "Demo tax restoration must be idempotent.",
  );
  assert(
    (await prisma.auditEvent.count({
      where: { businessId, entityType: "TaxPaymentRecord" },
    })) === auditAfter,
    "Demo restoration must preserve append-only payment audit history.",
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
    await exerciseReconciliationAndReversal(prisma);
    await exerciseTaxPayment(prisma);

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
      "FULLPG WRITE VALIDATION PASSED: mixed review, exact reconciliation, immutable reversal, deferred rollback, audit, concurrency, and restoration verified.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? sanitize(error.message).replace(/\s+/g, " ").slice(0, 500)
      : "unknown validation error";
  console.error(`Full PostgreSQL write validation failed safely: ${message}`);
  process.exitCode = 1;
});
