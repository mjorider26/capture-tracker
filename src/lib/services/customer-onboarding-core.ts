import { Prisma } from "@/generated/prisma/client";

export type OpeningAccount = { id: string; type: "CHECKING" | "SAVINGS" | "CREDIT_CARD"; ledgerAccountId: string; amount: string };
export type OpeningLine = { ledgerAccountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal };

/** Produces the exact balanced line plan used by the atomic starting-books write. */
export function planOpeningBalanceLines(accounts: OpeningAccount[], retainedEarningsLedgerId: string) {
  const lines: OpeningLine[] = [];
  let debit = new Prisma.Decimal(0), credit = new Prisma.Decimal(0);
  for (const account of accounts) {
    const amount = new Prisma.Decimal(account.amount);
    if (amount.isNegative() || !amount.isFinite()) throw new Error("Opening balance must be a finite non-negative amount.");
    if (amount.equals(0)) continue;
    const card = account.type === "CREDIT_CARD";
    lines.push({ ledgerAccountId: account.ledgerAccountId, debit: card ? new Prisma.Decimal(0) : amount, credit: card ? amount : new Prisma.Decimal(0) });
    if (card) credit = credit.plus(amount); else debit = debit.plus(amount);
  }
  const net = debit.minus(credit);
  if (!net.equals(0)) lines.push({ ledgerAccountId: retainedEarningsLedgerId, debit: net.lessThan(0) ? net.abs() : new Prisma.Decimal(0), credit: net.greaterThan(0) ? net : new Prisma.Decimal(0) });
  const totalDebit = lines.reduce((sum, line) => sum.plus(line.debit), new Prisma.Decimal(0));
  const totalCredit = lines.reduce((sum, line) => sum.plus(line.credit), new Prisma.Decimal(0));
  return { lines, totalDebit, totalCredit, balanced: totalDebit.equals(totalCredit) };
}
