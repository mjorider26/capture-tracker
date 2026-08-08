import { Prisma } from "../../generated/prisma/client";

export type CloseCheck = { key: string; label: string; count: number; detail: string };

export function closeReadiness(checks: CloseCheck[]) {
  const blockers = checks.filter((check) => check.count > 0);
  return { status: blockers.length ? "NOT_READY" as const : "READY_TO_CLOSE" as const, blockers, checks };
}

export function balancedJournalEntry(lines: Array<{ debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }>) {
  const debit = lines.reduce((sum, line) => sum.plus(line.debitAmount), new Prisma.Decimal(0));
  const credit = lines.reduce((sum, line) => sum.plus(line.creditAmount), new Prisma.Decimal(0));
  return debit.equals(credit) && debit.greaterThan(0);
}
