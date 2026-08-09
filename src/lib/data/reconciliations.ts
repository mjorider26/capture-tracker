import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";
import { calculateReconciliationBalances } from "@/lib/services/reconciliation-core";
import { buildStatementActivityCandidates } from "@/lib/services/statement-activity-matching-core";

const validId = (value: string) => /^[A-Za-z0-9_-]{1,191}$/.test(value);
const money = (value: Pick<Prisma.Decimal, "toFixed">) => value.toFixed(2);
export type ReconciliationListItem = { id: string | null; accountId: string; accountName: string; institutionName: string | null; lastFour: string | null; accountType: string; statementStartDate: string | null; statementEndDate: string | null; statementEndingBalance: string | null; calculatedBalance: string | null; difference: string | null; status: string; clearedItemCount: number; version: number | null; completedAt: string | null; needsReconciliation: boolean };

/** Every eligible active account gets a card, even before its first reconciliation. */
export async function getReconciliations(businessId: string): Promise<ReconciliationListItem[]> {
  noStore();
  const accounts = await prisma.financialAccount.findMany({
    where: { businessId, isActive: true, ownership: "BUSINESS", type: { in: ["CHECKING", "SAVINGS", "CREDIT_CARD"] } },
    include: {
      reconciliations: {
        include: { items: { where: { status: "CLEARED" }, include: { transaction: { select: { amount: true, direction: true } } } } },
        orderBy: [{ statementEndDate: "desc" }, { id: "asc" }],
        take: 1,
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return accounts.map((account) => {
    const record = account.reconciliations[0];
    if (!record) return { id: null, accountId: account.id, accountName: account.name, institutionName: account.institutionName, lastFour: account.lastFour, accountType: account.type, statementStartDate: null, statementEndDate: null, statementEndingBalance: null, calculatedBalance: null, difference: null, status: "NEEDS_RECONCILIATION", clearedItemCount: 0, version: null, completedAt: null, needsReconciliation: true };
    const balance = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, record.items.map((item) => item.transaction));
    return { id: record.id, accountId: account.id, accountName: account.name, institutionName: account.institutionName, lastFour: account.lastFour, accountType: account.type, statementStartDate: record.statementStartDate.toISOString(), statementEndDate: record.statementEndDate.toISOString(), statementEndingBalance: money(record.statementEndingBalance), calculatedBalance: money(balance.calculatedBalance), difference: money(balance.difference), status: record.status, clearedItemCount: record.items.length, version: record.version, completedAt: record.completedAt?.toISOString() ?? null, needsReconciliation: record.status !== "COMPLETED" };
  });
}

export async function getReconciliationDetail(businessId: string, reconciliationId: string) {
  noStore(); if (!validId(reconciliationId)) return null;
  const record = await prisma.reconciliation.findFirst({ where: { id: reconciliationId, businessId }, include: { financialAccount: { select: { name: true, ownership: true, type: true } }, items: { where: { status: "CLEARED" }, select: { transactionId: true } }, statementActivities: { include: { candidateDecisions: { select: { transactionId: true, activityVersion: true, transactionVersion: true } } }, orderBy: [{ activityDate: "asc" }, { id: "asc" }] } } }); if (!record) return null;
  const candidates = await prisma.transaction.findMany({ where: { businessId, accountId: record.financialAccountId, postedAt: { gte: record.statementStartDate, lte: record.statementEndDate } }, select: { id: true, postedAt: true, description: true, merchantName: true, sourceReference: true, amount: true, direction: true, status: true, version: true, correctionOfId: true, corrections: { select: { id: true }, take: 1 }, journalEntry: { select: { reversedByEntries: { select: { id: true }, take: 1 } } }, matchedStatementActivities: { select: { id: true }, take: 1 } }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] });
  const selected = new Set(record.items.map((item) => item.transactionId)); const balance = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, candidates.filter((candidate) => selected.has(candidate.id)));
  const activities = record.statementActivities.map((activity) => ({ id: activity.id, activityDate: activity.activityDate.toISOString(), description: activity.description, reference: activity.reference, amount: money(activity.amount), direction: activity.direction, status: activity.status, version: activity.version, matchedTransactionId: activity.matchedTransactionId, candidates: buildStatementActivityCandidates(activity, candidates.map((candidate) => ({ ...candidate, hasCorrections: candidate.corrections.length > 0, reversed: candidate.journalEntry?.reversedByEntries.length === 1, alreadyMatched: candidate.matchedStatementActivities.length > 0, rejected: activity.candidateDecisions.some((decision) => decision.transactionId === candidate.id && decision.activityVersion === activity.version && decision.transactionVersion === candidate.version) }))).map(({ transaction, score }) => ({ id: transaction.id, description: transaction.description, postedAt: transaction.postedAt.toISOString(), amount: money(transaction.amount), direction: transaction.direction, version: transaction.version, score })) }));
  return { id: record.id, accountName: record.financialAccount.name, statementStartDate: record.statementStartDate.toISOString(), statementEndDate: record.statementEndDate.toISOString(), statementOpeningBalance: money(record.statementOpeningBalance), statementEndingBalance: money(record.statementEndingBalance), calculatedBalance: money(balance.calculatedBalance), difference: money(balance.difference), status: record.status, version: record.version, completedAt: record.completedAt?.toISOString() ?? null, selectedIds: [...selected], candidates: candidates.map((item) => ({ ...item, postedAt: item.postedAt.toISOString(), amount: money(item.amount) })), activities };
}
