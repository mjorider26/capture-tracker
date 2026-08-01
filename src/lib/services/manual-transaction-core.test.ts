import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client";
import { accountingForManualTransaction, manualJournalLines, manualTransactionSchema, parseTransactionDate } from "./manual-transaction-core";

const key = "123e4567-e89b-42d3-a456-426614174000";
const base = { transactionDate: "2026-08-01", amount: "150.00", merchantOrPayer: "Example payer", description: "Manual entry", financialAccountId: "cash_1", categoryAccountId: "category_1", idempotencyKey: key };

function balance(lines: ReturnType<typeof manualJournalLines>) {
  const debit = lines.reduce((sum, line) => sum.plus(line.debitAmount), new Prisma.Decimal(0));
  const credit = lines.reduce((sum, line) => sum.plus(line.creditAmount), new Prisma.Decimal(0));
  return { debit: debit.toFixed(2), credit: credit.toFixed(2), balanced: debit.equals(credit) };
}

describe("manual transaction accounting rules", () => {
  it("posts income as cash debit and revenue credit", () => {
    const parsed = manualTransactionSchema.parse({ ...base, transactionType: "INCOME" });
    expect(accountingForManualTransaction(parsed)).toEqual({ direction: "INFLOW", intent: "BUSINESS", status: "APPROVED", categoryType: "INCOME" });
    expect(manualJournalLines({ total: "150.00", transactionType: "INCOME", direction: "INFLOW", cashAccountId: "cash", categoryAccountId: "revenue", contributionsAccountId: null, distributionsAccountId: null, businessAmount: null, personalAmount: null })).toEqual([
      { ledgerAccountId: "cash", debitAmount: "150.00", creditAmount: "0", memo: "Manual income deposit" },
      { ledgerAccountId: "revenue", debitAmount: "0", creditAmount: "150.00", memo: "Income category" },
    ]);
  });

  it("posts a business expense as expense debit and cash credit", () => {
    const parsed = manualTransactionSchema.parse({ ...base, transactionType: "BUSINESS_EXPENSE" });
    expect(accountingForManualTransaction(parsed)).toEqual({ direction: "OUTFLOW", intent: "BUSINESS", status: "APPROVED", categoryType: "EXPENSE" });
    expect(balance(manualJournalLines({ total: "150.00", transactionType: "BUSINESS_EXPENSE", direction: "OUTFLOW", cashAccountId: "cash", categoryAccountId: "expense", contributionsAccountId: null, distributionsAccountId: null, businessAmount: null, personalAmount: null }))).toEqual({ debit: "150.00", credit: "150.00", balanced: true });
  });

  it("uses owner contribution or distribution equity for personal activity", () => {
    const inflow = manualJournalLines({ total: "150.00", transactionType: "PERSONAL", direction: "INFLOW", cashAccountId: "cash", categoryAccountId: null, contributionsAccountId: "contributions", distributionsAccountId: "distributions", businessAmount: null, personalAmount: null });
    const outflow = manualJournalLines({ total: "150.00", transactionType: "PERSONAL", direction: "OUTFLOW", cashAccountId: "cash", categoryAccountId: null, contributionsAccountId: "contributions", distributionsAccountId: "distributions", businessAmount: null, personalAmount: null });
    expect(inflow[1]?.ledgerAccountId).toBe("contributions");
    expect(outflow[0]?.ledgerAccountId).toBe("distributions");
    expect(outflow.some((line) => line.ledgerAccountId === "expense")).toBe(false);
    expect(balance(inflow).balanced && balance(outflow).balanced).toBe(true);
  });

  it("posts mixed activity with an exact business category and personal equity split", () => {
    const parsed = manualTransactionSchema.parse({ ...base, transactionType: "MIXED", cashDirection: "OUTFLOW", businessAmount: "100.10", personalAmount: "49.90" });
    expect(accountingForManualTransaction(parsed).intent).toBe("MIXED");
    const lines = manualJournalLines({ total: "150.00", transactionType: "MIXED", direction: "OUTFLOW", cashAccountId: "cash", categoryAccountId: "expense", contributionsAccountId: "contributions", distributionsAccountId: "distributions", businessAmount: "100.10", personalAmount: "49.90" });
    expect(lines.map((line) => line.ledgerAccountId)).toEqual(["expense", "distributions", "cash"]);
    expect(balance(lines)).toEqual({ debit: "150.00", credit: "150.00", balanced: true });
  });

  it.each(["", "0", "-1.00", "1e2", "1.234", "99999999999999999.99"])("rejects malformed or invalid amount %s", (amount) => {
    expect(manualTransactionSchema.safeParse({ ...base, transactionType: "INCOME", amount }).success).toBe(false);
  });

  it("rejects invalid dates and non-exact mixed splits", () => {
    expect(parseTransactionDate("2026-02-29")).toBeNull();
    expect(manualTransactionSchema.safeParse({ ...base, transactionType: "MIXED", cashDirection: "OUTFLOW", businessAmount: "100.00", personalAmount: "49.99" }).success).toBe(false);
  });
});
