import { describe, expect, it } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import {
  calculateReconciliationBalances,
  evaluateInitialReconciliationReadiness,
  parseReconciliationInput,
  reconciliationSaveSchema,
  reconciliationStartSchema,
} from "./reconciliation-core";
import {
  invertJournalLines,
  journalReversalSchema,
} from "./journal-reversal-core";
describe("reconciliation arithmetic", () => {
  it("uses exact statement minus book difference", () => {
    const result = calculateReconciliationBalances("0.00", "3550.00", [
      { amount: "5000.00", direction: "INFLOW" },
      { amount: "450.00", direction: "OUTFLOW" },
      { amount: "300.00", direction: "OUTFLOW" },
      { amount: "700.00", direction: "OUTFLOW" },
    ]);
    expect(result.calculatedBalance.toFixed(2)).toBe("3550.00");
    expect(result.difference.toFixed(2)).toBe("0.00");
    expect(result.balanced).toBe(true);
  });
  it("rejects scientific notation, unsupported precision, and malformed versions", () => {
    expect(
      parseReconciliationInput(reconciliationStartSchema, {
        accountId: "account_1",
        statementStartDate: "2026-07-01",
        statementEndDate: "2026-07-31",
        statementEndingBalance: "1e2",
      }).ok,
    ).toBe(false);
    expect(
      parseReconciliationInput(reconciliationStartSchema, {
        accountId: "account_1",
        statementStartDate: "2026-07-01",
        statementEndDate: "2026-07-31",
        statementEndingBalance: "1.001",
      }).ok,
    ).toBe(false);
    expect(
      parseReconciliationInput(reconciliationSaveSchema, {
        reconciliationId: "rec_1",
        expectedVersion: "1.1",
        transactionIds: [],
      }).ok,
    ).toBe(false);
  });
});
describe("initial reconciliation readiness", () => {
  it("requires every business account and uses the earliest latest statement date", () => {
    const firstOnly = evaluateInitialReconciliationReadiness(
      ["checking", "card"],
      [
        {
          financialAccountId: "checking",
          statementEndDate: new Date("2026-07-31T12:00:00Z"),
        },
      ],
    );
    expect(firstOnly).toEqual({ ready: false, booksCurrentThrough: null });

    const complete = evaluateInitialReconciliationReadiness(
      ["checking", "card"],
      [
        {
          financialAccountId: "checking",
          statementEndDate: new Date("2026-08-31T12:00:00Z"),
        },
        {
          financialAccountId: "checking",
          statementEndDate: new Date("2026-07-31T12:00:00Z"),
        },
        {
          financialAccountId: "card",
          statementEndDate: new Date("2026-08-15T12:00:00Z"),
        },
      ],
    );
    expect(complete.ready).toBe(true);
    expect(complete.booksCurrentThrough?.toISOString()).toBe(
      "2026-08-15T12:00:00.000Z",
    );
  });
});
describe("journal reversal helpers", () => {
  it("inverts debit and credit exactly", () => {
    expect(
      invertJournalLines([
        {
          ledgerAccountId: "a",
          debitAmount: new Prisma.Decimal("12.50"),
          creditAmount: new Prisma.Decimal("0"),
          memo: null,
        },
        {
          ledgerAccountId: "b",
          debitAmount: new Prisma.Decimal("0"),
          creditAmount: new Prisma.Decimal("12.50"),
          memo: "income",
        },
      ]),
    ).toEqual([
      {
        ledgerAccountId: "a",
        lineNumber: 1,
        debitAmount: "0.00",
        creditAmount: "12.50",
        memo: null,
      },
      {
        ledgerAccountId: "b",
        lineNumber: 2,
        debitAmount: "12.50",
        creditAmount: "0.00",
        memo: "income",
      },
    ]);
  });
  it("requires a concise reason and explicit confirmation", () => {
    expect(
      journalReversalSchema.safeParse({
        journalEntryId: "entry_1",
        expectedVersion: "1",
        reversalDate: "2026-07-01",
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      journalReversalSchema.safeParse({
        journalEntryId: "entry_1",
        expectedVersion: "1",
        reversalDate: "2026-07-01",
        reason: "Correct fictional source",
      }).success,
    ).toBe(false);
    expect(
      journalReversalSchema.safeParse({
        journalEntryId: "entry_1",
        expectedVersion: "1",
        reversalDate: "2026-07-01",
        reason: "Correct fictional source",
        confirmed: "on",
      }).success,
    ).toBe(true);
  });
});
