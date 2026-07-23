import type { PrismaClient } from "../src/generated/prisma/client";

export const demoMoneyIds = {
  business: "demo-business-northstar-field-solutions",
  checking: "demo-financial-account-business-checking",
  pendingReview: "demo-transaction-pending-review",
} as const;

// This is the only mutable Phase 5 demo transaction. Posted and historical demo records are intentionally untouched.
export async function restoreDemoMoneyBaseline(
  client: PrismaClient,
): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.transactionSplit.deleteMany({
      where: {
        businessId: demoMoneyIds.business,
        transactionId: demoMoneyIds.pendingReview,
      },
    });
    await tx.transaction.upsert({
      where: { id: demoMoneyIds.pendingReview },
      create: {
        id: demoMoneyIds.pendingReview,
        businessId: demoMoneyIds.business,
        accountId: demoMoneyIds.checking,
        postedAt: new Date("2026-07-20T12:00:00.000Z"),
        description: "Unreviewed field fuel purchase",
        merchantName: "Fictional Fuel Stop",
        amount: "125.00",
        direction: "OUTFLOW",
        intent: "UNREVIEWED",
        status: "PENDING_REVIEW",
        sourceReference: "demo-pending-review-2026-07",
        approvedAt: null,
        approvedByMembershipId: null,
        version: 1,
      },
      update: {
        businessId: demoMoneyIds.business,
        accountId: demoMoneyIds.checking,
        postedAt: new Date("2026-07-20T12:00:00.000Z"),
        description: "Unreviewed field fuel purchase",
        merchantName: "Fictional Fuel Stop",
        amount: "125.00",
        direction: "OUTFLOW",
        intent: "UNREVIEWED",
        status: "PENDING_REVIEW",
        sourceReference: "demo-pending-review-2026-07",
        approvedAt: null,
        approvedByMembershipId: null,
        version: 1,
      },
    });
  });
}
