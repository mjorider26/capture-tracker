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
  | "externalTransaction"
  | "ownerMoneyTransfer"
  | "payrollBankMatch"
  | "payrollRun"
  | "fixedAsset"
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
    externalTransactions,
    ownerTransfers,
    payrollMatches,
    payrollRuns,
    fixedAssets,
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
        malwareScanStatus: true,
        extractionAttempts: { select: { status: true, candidates: { select: { id: true, fieldType: true, reviewState: true } } } },
      },
    }),
    client.documentMatchSuggestion.findMany({
      where: { businessId, status: "SUGGESTED", run: { status: "COMPLETED" } },
      select: { id: true, status: true, score: true, transactionAmount: true, transactionPostedAt: true, run: { select: { status: true, document: { select: { id: true, displayName: true, malwareScanStatus: true } } } } },
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
    client.externalTransaction.findMany({
      where: { businessId, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "POSSIBLE_DUPLICATE"] } },
      select: { id: true, description: true, transactionDate: true, amount: true, status: true, financialAccount: { select: { name: true } } },
    }),
    client.ownerMoneyTransfer?.findMany({ where: { businessId, status: "PENDING_REVIEW" }, select: { id: true, direction: true, classification: true, externalTransaction: { select: { description: true, amount: true } } } }) ?? Promise.resolve([]),
    client.payrollBankMatch?.findMany({ where: { businessId, status: { not: "MATCHED" } }, select: { id: true, kind: true, status: true, payrollRun: { select: { payDate: true } } } }) ?? Promise.resolve([]),
    client.payrollRun?.findMany({ where: { businessId, status: "PROCESSED" }, select: { id: true, payDate: true, netPay: true, employeeWithholding: true, employeePayrollTax: true, otherDeductions: true, employerPayrollTax: true, providerFee: true, matches: { select: { kind: true, status: true } } } }) ?? Promise.resolve([]),
    client.fixedAsset?.findMany({ where: { businessId, status: "POSSIBLE_REVIEW" }, select: { id: true, name: true, acquisitionCost: true, acquisitionDate: true, status: true } }) ?? Promise.resolve([]),
  ]);

  return buildWeeklyReviewTasks({ transactions, documents, matchSuggestions, reconciliationItems, statementActivities, taxEstimates, externalTransactions, ownerTransfers, payrollMatches, payrollRuns, fixedAssets });
}

export async function loadWeeklyReviewTaskCount(client: TaskClient, businessId: string) {
  return countWeeklyReviewTasks(await loadWeeklyReviewTasks(client, businessId));
}
