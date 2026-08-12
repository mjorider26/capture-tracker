import { Prisma, type PrismaClient } from "../../generated/prisma/client";

import { booksCurrentThrough } from "./s-corp-intelligence-core";

export type BooksCurrentThrough = { date: Date | null; blockers: Array<{ date: Date; label: string; count: number }>; accountCoverage: Array<{ accountName: string; reconciledThrough: Date | null; bankFeedMethod: "MANUAL" | "PLAID"; activityMayBeMissingAfter: Date | null }> };

/** Evidence-backed current-through calculation; an account without a completed reconciliation leaves the result incomplete. */
export async function getBooksCurrentThrough(client: PrismaClient, businessId: string): Promise<BooksCurrentThrough> {
  const today = new Date();
  const [accounts, unresolved, duplicates, transfers, reimbursements, payroll, assets, journals] = await Promise.all([
    client.financialAccount.findMany({ where: { businessId, ownership: "BUSINESS", isActive: true }, select: { id: true, name: true, bankFeedMethod: true, reconciliations: { where: { status: "COMPLETED", statementEndDate: { lte: today } }, select: { statementEndDate: true }, orderBy: { statementEndDate: "desc" }, take: 1 } } }),
    client.externalTransaction.findMany({ where: { businessId, transactionDate: { lte: today }, status: { in: ["IMPORTED", "NORMALIZED", "NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, select: { transactionDate: true } }),
    client.externalTransaction.findMany({ where: { businessId, transactionDate: { lte: today }, status: "POSSIBLE_DUPLICATE" }, select: { transactionDate: true } }),
    client.ownerMoneyTransfer.findMany({ where: { businessId, status: "PENDING_REVIEW", externalTransaction: { transactionDate: { lte: today } } }, select: { externalTransaction: { select: { transactionDate: true } } } }),
    client.reimbursementClaim.findMany({ where: { businessId, status: { in: ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION", "APPROVED"] }, createdAt: { lte: today } }, select: { createdAt: true } }),
    client.payrollBankMatch.findMany({ where: { businessId, status: { not: "MATCHED" }, payrollRun: { payDate: { lte: today } } }, select: { payrollRun: { select: { payDate: true } } } }),
    client.fixedAsset.findMany({ where: { businessId, status: "POSSIBLE_REVIEW", acquisitionDate: { lte: today } }, select: { acquisitionDate: true } }),
    client.journalEntry.findMany({ where: { businessId, status: "POSTED", entryDate: { lte: today } }, include: { lines: { select: { debitAmount: true, creditAmount: true } } } }),
  ]);
  const staleBefore = new Date(today.getTime() - 14 * 86_400_000);
  const accountCoverage = accounts.map((account) => { const reconciledThrough = account.reconciliations[0]?.statementEndDate ?? null; return { accountName: account.name, reconciledThrough, bankFeedMethod: account.bankFeedMethod, activityMayBeMissingAfter: account.bankFeedMethod === "MANUAL" && reconciledThrough && reconciledThrough < staleBefore ? reconciledThrough : null }; });
  if (!accounts.length || accountCoverage.some((account) => !account.reconciledThrough)) return { date: null, blockers: [], accountCoverage };
  const candidate = accountCoverage.reduce<Date>((earliest, account) => account.reconciledThrough! < earliest ? account.reconciledThrough! : earliest, accountCoverage[0]!.reconciledThrough!);
  const unbalanced = journals.filter((entry) => !entry.lines.reduce((sum, line) => sum.plus(line.debitAmount).minus(line.creditAmount), new Prisma.Decimal(0)).isZero()).map((entry) => entry.entryDate);
  const groups = [
    ["Imported activity", unresolved.map((item) => item.transactionDate)], ["Possible duplicates", duplicates.map((item) => item.transactionDate)], ["Owner transfers", transfers.map((item) => item.externalTransaction.transactionDate)], ["Reimbursements", reimbursements.map((item) => item.createdAt)], ["Payroll reconciliation", payroll.map((item) => item.payrollRun.payDate)], ["Fixed-asset review", assets.map((item) => item.acquisitionDate)], ["Journal integrity", unbalanced],
  ] as const;
  const blockers = groups.flatMap(([label, dates]) => dates.length ? [{ label, date: dates.reduce((first, item) => item < first ? item : first), count: dates.length }] : []);
  return { date: booksCurrentThrough(candidate, blockers.map((item) => item.date)), blockers: blockers.sort((a, b) => a.date.getTime() - b.date.getTime()), accountCoverage };
}
