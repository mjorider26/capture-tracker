import type { PrismaClient } from "@/generated/prisma/client";

type WeeklyReviewCountClient = Pick<
  PrismaClient,
  | "transaction"
  | "document"
  | "documentMatchSuggestion"
  | "reconciliation"
  | "quarterlyTaxEstimate"
  | "payrollRun"
  | "externalTransaction"
>;

export async function loadWeeklyReviewAttention(
  client: WeeklyReviewCountClient,
  businessId: string,
) {
  // These calls can also run on Prisma's single-connection transaction client.
  // Keep them ordered so one request never multiplexes operations on that client.
  const transactions = await client.transaction.count({
    where: { businessId, status: "PENDING_REVIEW" },
  });
  const documents = await client.document.count({
    where: {
      businessId,
      OR: [
        { status: "PENDING_VALIDATION" },
        { status: "QUARANTINED", malwareScanStatus: { not: "PENDING" } },
        { status: "REJECTED" },
        {
          extractionAttempts: {
            some: { status: { in: ["FAILED", "STALE"] } },
          },
        },
        { transactions: { none: { unlinkedAt: null } }, status: "ACTIVE", malwareScanStatus: "CLEAN" },
      ],
    },
  });
  const matches = await client.documentMatchSuggestion.count({
    where: { businessId, status: "SUGGESTED" },
  });
  const reconciliations = await client.reconciliation.count({
    where: { businessId, status: { not: "COMPLETED" } },
  });
  const tax = await client.quarterlyTaxEstimate.count({
    where: { businessId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } },
  });
  const payroll = await client.payrollRun.count({
    where: { businessId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } },
  });
  const importedActivity = await client.externalTransaction.count({
    where: { businessId, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "POSSIBLE_DUPLICATE"] } },
  });

  return {
    transactions,
    documents,
    matches,
    reconciliations,
    tax,
    payroll,
    importedActivity,
    total: transactions + documents + matches + reconciliations + tax + payroll + importedActivity,
  };
}
