import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import {
  buildWeeklyReviewTasks,
  countWeeklyReviewTasks,
  type WeeklyReviewTask,
} from "./weekly-review-tasks-core";

type TaskClient = Pick<
  PrismaClient,
  | "transaction"
  | "document"
  | "documentMatchSuggestion"
  | "reconciliationItem"
  | "statementActivity"
  | "quarterlyTaxEstimate"
>;

export async function loadWeeklyReviewTasks(
  client: TaskClient,
  businessId: string,
): Promise<WeeklyReviewTask[]> {
  const [
    transactions,
    documents,
    matchSuggestions,
    reconciliationItems,
    statementActivities,
    taxEstimates,
  ] = await Promise.all([
    client.transaction.findMany({
      where: { businessId, OR: [{ status: "PENDING_REVIEW" }, { intent: "MIXED" }] },
      select: { id: true, description: true, postedAt: true, amount: true, status: true, intent: true, splits: { select: { amount: true } } },
    }),
    client.document.findMany({
      where: { businessId },
      select: {
        id: true,
        displayName: true,
        uploadedAt: true,
        status: true,
        extractionAttempts: { select: { status: true, candidates: { select: { id: true, fieldType: true, reviewState: true } } } },
      },
    }),
    client.documentMatchSuggestion.findMany({
      where: { businessId, status: "SUGGESTED", run: { status: "COMPLETED" } },
      select: { id: true, status: true, score: true, transactionAmount: true, transactionPostedAt: true, run: { select: { status: true, document: { select: { id: true, displayName: true } } } } },
    }),
    client.reconciliationItem.findMany({
      where: { businessId, status: "OUTSTANDING", reconciliation: { status: { in: ["DRAFT", "IN_PROGRESS"] } } },
      select: { id: true, status: true, reconciliation: { select: { id: true, status: true, statementEndDate: true, financialAccount: { select: { name: true } } } }, transaction: { select: { id: true, description: true, amount: true, postedAt: true } } },
    }),
    client.statementActivity.findMany({ where: { businessId, status: "UNMATCHED", reconciliation: { status: { in: ["DRAFT", "IN_PROGRESS"] } } }, select: { id: true, description: true, activityDate: true, amount: true, reconciliation: { select: { id: true, status: true, financialAccount: { select: { name: true } } } } } }),
    client.quarterlyTaxEstimate.findMany({
      where: { businessId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } },
      select: { id: true, status: true, taxYear: true, quarter: true, jurisdictionCode: true, dueDate: true, recommendedPayment: true, payments: { select: { amount: true, status: true } } },
    }),
  ]);

  return buildWeeklyReviewTasks({ transactions, documents, matchSuggestions, reconciliationItems, statementActivities, taxEstimates });
}

export async function loadWeeklyReviewTaskCount(client: TaskClient, businessId: string) {
  return countWeeklyReviewTasks(await loadWeeklyReviewTasks(client, businessId));
}
