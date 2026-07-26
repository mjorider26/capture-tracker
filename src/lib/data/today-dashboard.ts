import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import {
  calculateCashBalance,
  calculateRemainingTaxObligation,
  calculateReservePosition,
  formatUsd,
  orderReviewTasks,
  selectLatestTaxEstimate,
} from "./today-dashboard-core";
import { loadWeeklyReviewAttention } from "../services/weekly-review-counts";
import {
  prioritizeTodayAttention,
  type TodayAttentionItem,
} from "./today-dashboard-presentation";

export type TodayDashboard = {
  businessName: string;
  availableCash: {
    value: string;
    explanation: string;
    status: "positive" | "neutral";
  };
  taxReserve: {
    value: string;
    explanation: string;
    status: "available" | "unavailable";
  };
  projectedTax: {
    value: string;
    explanation: string;
    status: "attention" | "neutral";
    dueDate: string | null;
  };
  reservePosition: {
    value: string;
    explanation: string;
    status: "unknown" | "gap" | "surplus";
  };
  cashVisual: {
    availableCash: string;
    dedicatedReserve: string | null;
    reserveSharePercent: number | null;
  };
  attention: TodayAttentionItem[];
  weeklyReview: {
    status: string;
    estimatedMinutes: number;
    completedCount: number;
    tasks: Array<{
      id: string;
      title: string;
      explanation: string | null;
      category: string;
      priority: string;
      complete: boolean;
    }>;
  } | null;
  changes: Array<{
    id: string;
    title: string;
    date: string;
    amount: string | null;
    explanation: string;
    tone: "income" | "expense" | "planning" | "equity";
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Los_Angeles",
});

function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

function entryExplanation(entry: {
  id: string;
  entryDate: Date;
  description: string;
  sourceType: string;
  lines: Array<{ debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }>;
}) {
  const amount = entry.lines.reduce(
    (largest, line) =>
      Prisma.Decimal.max(largest, line.debitAmount, line.creditAmount),
    new Prisma.Decimal(0),
  );
  const content =
    {
      BANK_TRANSACTION: [
        "Account activity posted",
        "A reviewed bank or card transaction was recorded.",
        "expense",
      ] as const,
      REIMBURSEMENT_CLAIM: [
        "Reimbursement recorded",
        "A personally paid business expense and its reimbursement were recorded.",
        "expense",
      ] as const,
      PAYROLL_RUN: [
        "Payroll processed",
        "Payroll wages and employer payroll tax were recorded separately.",
        "expense",
      ] as const,
      OWNER_DISTRIBUTION: [
        "Owner distribution paid",
        "This is an equity distribution, not a business expense.",
        "equity",
      ] as const,
    }[entry.sourceType] ??
    ([
      "Ledger activity posted",
      "A posted journal entry changed the business books.",
      "planning",
    ] as const);

  if (entry.description.toLowerCase().includes("commission")) {
    return {
      id: entry.id,
      date: entry.entryDate,
      title: "Commission income received",
      amount: formatUsd(amount),
      explanation: "Commission income increased business checking.",
      tone: "income" as const,
    };
  }

  return {
    id: entry.id,
    date: entry.entryDate,
    title: content[0],
    amount: formatUsd(amount),
    explanation: content[1],
    tone: content[2],
  };
}

// Trusted callers supply businessId from server-side business context only.
export async function getTodayDashboard(
  businessId: string,
): Promise<TodayDashboard> {
  noStore();

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { displayName: true },
  });
  const cashAccounts = await prisma.financialAccount.findMany({
    where: {
      businessId,
      ownership: "BUSINESS",
      type: { in: ["CHECKING", "SAVINGS"] },
      isActive: true,
    },
    include: {
      transactions: {
        where: { status: "APPROVED" },
        select: { amount: true, direction: true, status: true },
      },
    },
  });
  const taxReserveAccounts = await prisma.financialAccount.findMany({
    where: {
      businessId,
      ownership: "BUSINESS",
      type: { in: ["CHECKING", "SAVINGS"] },
      isTaxReserve: true,
      isActive: true,
    },
    include: {
      transactions: {
        where: { status: "APPROVED" },
        select: { amount: true, direction: true, status: true },
      },
    },
  });
  const estimates = await prisma.quarterlyTaxEstimate.findMany({
    where: { businessId, status: { notIn: ["VOIDED", "SUPERSEDED"] } },
    select: {
      id: true,
      taxYear: true,
      quarter: true,
      revisionNumber: true,
      projectedTaxLiability: true,
      withholdingCredits: true,
      priorPayments: true,
      dueDate: true,
    },
  });
  const payments = await prisma.taxPaymentRecord.findMany({
    where: { businessId, status: "RECORDED" },
    select: { amount: true, status: true, estimateId: true },
  });
  const review = await prisma.weeklyReview.findFirst({
    where: { businessId },
    orderBy: { weekStart: "desc" },
    include: { tasks: true },
  });
  const entries = await prisma.journalEntry.findMany({
    where: { businessId, status: "POSTED" },
    orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }],
    take: 4,
    select: {
      id: true,
      entryDate: true,
      description: true,
      sourceType: true,
      lines: { select: { debitAmount: true, creditAmount: true } },
    },
  });

  const cash = calculateCashBalance(cashAccounts);
  const reserve =
    taxReserveAccounts.length > 0
      ? calculateCashBalance(taxReserveAccounts)
      : null;
  const estimate = selectLatestTaxEstimate(estimates);
  // Remaining tax obligation subtracts seeded withholding, prior payments, and only recorded payments tied to the selected estimate.
  const obligation = estimate
    ? calculateRemainingTaxObligation(
        estimate,
        payments.filter((payment) => payment.estimateId === estimate.id),
      )
    : null;
  const reservePosition = calculateReservePosition(reserve, obligation);
  const changes: Array<{
    id: string;
    date: Date;
    title: string;
    amount: string | null;
    explanation: string;
    tone: "income" | "expense" | "planning" | "equity";
  }> = entries.map(entryExplanation);

  if (estimate) {
    changes.push({
      id: `tax-${estimate.id}`,
      date: estimate.dueDate,
      title: "Quarterly tax estimate ready",
      amount: formatUsd(obligation ?? new Prisma.Decimal(0)),
      explanation:
        "The estimate reflects projected liability after withholding and recorded payments.",
      tone: "planning",
    });
  }

  const orderedChanges = changes
    .sort(
      (left, right) =>
        right.date.getTime() - left.date.getTime() ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 5)
    .map(({ date, ...change }) => ({ ...change, date: formatDate(date) }));
  const orderedTasks = review ? orderReviewTasks(review.tasks) : [];
  const completedCount = orderedTasks.filter(
    (task) => task.status === "COMPLETED" || task.status === "DISMISSED",
  ).length;
  const attentionCounts = await loadWeeklyReviewAttention(prisma, businessId);
  const reviewTasks = orderedTasks.length - completedCount;
  const reserveSharePercent =
    reserve && cash.greaterThan(0)
      ? Prisma.Decimal.min(
          Prisma.Decimal.max(
            reserve.dividedBy(cash).times(100),
            new Prisma.Decimal(0),
          ),
          new Prisma.Decimal(100),
        )
          .toDecimalPlaces(0)
          .toNumber()
      : null;

  return {
    businessName: business.displayName,
    availableCash: {
      value: formatUsd(cash),
      explanation:
        "Business checking and savings opening balances plus approved inflows, less approved outflows. Credit cards and personal accounts are excluded.",
      status: cash.greaterThan(0) ? "positive" : "neutral",
    },
    taxReserve:
      reserve === null
        ? {
            value: "Not configured",
            explanation:
              "No dedicated business cash account is marked as a tax reserve.",
            status: "unavailable",
          }
        : {
            value: formatUsd(reserve),
            explanation:
              "Approved activity in dedicated tax-reserve cash accounts.",
            status: "available",
          },
    projectedTax:
      obligation === null
        ? {
            value: "Not available",
            explanation: "No current tax estimate is available.",
            status: "neutral",
            dueDate: null,
          }
        : {
            value: formatUsd(obligation),
            explanation:
              "Remaining estimate after withholding, prior payments, and recorded payments.",
            status: "attention",
            dueDate: formatDate(estimate!.dueDate),
          },
    reservePosition:
      reservePosition === null
        ? {
            value: "Not configured",
            explanation:
              "A dedicated reserve and a tax obligation are both required to calculate this.",
            status: "unknown",
          }
        : reservePosition.greaterThanOrEqualTo(0)
          ? {
              value: formatUsd(reservePosition),
              explanation:
                "Dedicated reserve exceeds the remaining projected obligation.",
              status: "surplus",
            }
          : {
              value: formatUsd(reservePosition.abs()),
              explanation:
                "Additional dedicated reserve is needed to cover the remaining projected obligation.",
              status: "gap",
          },
    cashVisual: {
      availableCash: formatUsd(cash),
      dedicatedReserve: reserve ? formatUsd(reserve) : null,
      reserveSharePercent,
    },
    attention: prioritizeTodayAttention({
      ...attentionCounts,
      reviewTasks,
    }),
    weeklyReview: review
      ? {
          status: review.status,
          estimatedMinutes: review.estimatedCompletionMinutes,
          completedCount,
          tasks: orderedTasks.map((task) => ({
            id: task.id,
            title: task.title,
            explanation: task.explanation,
            category: task.category,
            priority: task.priority,
            complete:
              task.status === "COMPLETED" || task.status === "DISMISSED",
          })),
        }
      : null,
    changes: orderedChanges,
  };
}
