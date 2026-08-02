import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const version = z.string().regex(/^(?:[1-9]\d{0,8})$/).transform(Number);

export const statementMatchSchema = z.object({
  statementActivityId: id,
  transactionId: id,
  expectedActivityVersion: version,
  expectedTransactionVersion: version,
  expectedReconciliationVersion: version,
});

export const statementUnmatchSchema = z.object({
  statementActivityId: id,
  expectedActivityVersion: version,
  expectedReconciliationVersion: version,
});

export type MatchableStatementActivity = {
  id: string;
  activityDate: Date;
  description: string;
  reference: string | null;
  amount: { toFixed: (digits: number) => string };
  direction: string;
  status: string;
  version: number;
};

export type MatchableTransaction = {
  id: string;
  postedAt: Date;
  description: string;
  merchantName: string | null;
  sourceReference: string | null;
  amount: { toFixed: (digits: number) => string };
  direction: string;
  status: string;
  version: number;
  correctionOfId: string | null;
  hasCorrections: boolean;
  reversed: boolean;
  alreadyMatched: boolean;
  rejected: boolean;
};

export function isEligibleStatementTransaction(activity: MatchableStatementActivity, transaction: MatchableTransaction) {
  return activity.status === "UNMATCHED" &&
    ["APPROVED", "EXCLUDED"].includes(transaction.status) &&
    activity.amount.toFixed(2) === transaction.amount.toFixed(2) &&
    activity.direction === transaction.direction &&
    !transaction.hasCorrections && !transaction.reversed && !transaction.alreadyMatched && !transaction.rejected;
}

export function statementCandidateScore(activity: MatchableStatementActivity, transaction: MatchableTransaction) {
  const days = Math.abs(activity.activityDate.getTime() - transaction.postedAt.getTime()) / 86_400_000;
  const words = `${activity.description} ${activity.reference ?? ""}`.toLowerCase().split(/\W+/).filter(Boolean);
  const matchText = `${transaction.description} ${transaction.merchantName ?? ""} ${transaction.sourceReference ?? ""}`.toLowerCase();
  const textHits = words.filter((word) => word.length > 2 && matchText.includes(word)).length;
  return Math.max(0, 100 - Math.min(60, Math.round(days) * 3) + Math.min(20, textHits * 5));
}

export function buildStatementActivityCandidates(activity: MatchableStatementActivity, transactions: MatchableTransaction[]) {
  return transactions.filter((transaction) => isEligibleStatementTransaction(activity, transaction)).map((transaction) => ({ transaction, score: statementCandidateScore(activity, transaction) })).sort((left, right) => right.score - left.score || left.transaction.postedAt.getTime() - right.transaction.postedAt.getTime() || left.transaction.id.localeCompare(right.transaction.id));
}
