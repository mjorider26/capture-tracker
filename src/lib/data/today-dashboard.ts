import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import {
  calculateRemainingTaxObligation,
  calculateReservePosition,
  formatUsd,
  selectLatestTaxEstimate,
} from "./today-dashboard-core";
import { loadWeeklyReviewTasks } from "../services/weekly-review-tasks";
import type { WeeklyReviewTask } from "../services/weekly-review-tasks-core";
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
  currentActivity: { income: string; expenses: string; unreviewedTransactions: number; documentAttention: number };
  isEmptyAccount: boolean;
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
    tasks: WeeklyReviewTask[];
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

  const [business, cashAccounts, estimates, payments, review, entries, tasks] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { displayName: true } }),
    prisma.financialAccount.findMany({
      where: { businessId, ownership: "BUSINESS", type: { in: ["CHECKING", "SAVINGS"] }, isActive: true },
      select: { id: true, openingBalance: true, isTaxReserve: true, ledgerAccount: { select: { id: true } } },
    }),
    prisma.quarterlyTaxEstimate.findMany({
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
    }),
    prisma.taxPaymentRecord.findMany({ where: { businessId, status: "RECORDED" }, select: { amount: true, status: true, estimateId: true } }),
    prisma.weeklyReview.findFirst({ where: { businessId }, orderBy: { weekStart: "desc" } }),
    prisma.journalEntry.findMany({
      where: { businessId, status: "POSTED" }, orderBy: [{ entryDate: "desc" }, { entryNumber: "desc" }], take: 4,
      select: { id: true, entryDate: true, description: true, sourceType: true, lines: { select: { debitAmount: true, creditAmount: true } } },
    }),
    loadWeeklyReviewTasks(prisma, businessId),
  ]);
  const taxReserveAccounts = cashAccounts.filter((account) => account.isTaxReserve);

  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const cashLedgerIds = cashAccounts.flatMap((account) => account.ledgerAccount ? [account.ledgerAccount.id] : []);
  const reserveLedgerIds = taxReserveAccounts.flatMap((account) => account.ledgerAccount ? [account.ledgerAccount.id] : []);
  const [cashLines, periodLines, unreviewedTransactions, documentAttention] = await Promise.all([
    cashLedgerIds.length ? prisma.journalLine.findMany({ where: { businessId, ledgerAccountId: { in: cashLedgerIds }, journalEntry: { status: "POSTED" } }, select: { ledgerAccountId: true, debitAmount: true, creditAmount: true } }) : [],
    prisma.journalLine.findMany({ where: { businessId, journalEntry: { status: "POSTED", entryDate: { gte: monthStart } } }, select: { debitAmount: true, creditAmount: true, ledgerAccount: { select: { type: true } } } }),
    prisma.transaction.count({ where: { businessId, status: "PENDING_REVIEW" } }),
    prisma.document.count({ where: { businessId, OR: [{ status: "PENDING_VALIDATION" }, { status: "QUARANTINED", malwareScanStatus: { not: "PENDING" } }, { status: "REJECTED" }, { transactions: { none: { unlinkedAt: null } }, status: "ACTIVE", malwareScanStatus: "CLEAN" }] } }),
  ]);

  const cashBalance = (accounts: typeof cashAccounts, ids: string[]) => accounts.reduce((total, account) => total.plus(account.openingBalance), new Prisma.Decimal(0)).plus(cashLines.filter((line) => ids.includes(line.ledgerAccountId)).reduce((total, line) => total.plus(line.debitAmount).minus(line.creditAmount), new Prisma.Decimal(0)));
  const cash = cashBalance(cashAccounts, cashLedgerIds);
  const reserve = reserveLedgerIds.length ? cashBalance(taxReserveAccounts, reserveLedgerIds) : null;
  const income = periodLines.filter((line) => line.ledgerAccount.type === "INCOME").reduce((total, line) => total.plus(line.creditAmount).minus(line.debitAmount), new Prisma.Decimal(0));
  const expenses = periodLines.filter((line) => line.ledgerAccount.type === "EXPENSE").reduce((total, line) => total.plus(line.debitAmount).minus(line.creditAmount), new Prisma.Decimal(0));
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
  const taskCounts = tasks.reduce(
    (counts, task) => {
      if (task.category === "Transactions") counts.transactions += 1;
      if (task.category === "Documents") counts.documents += 1;
      if (task.category === "Reconciliation") counts.reconciliations += 1;
      if (task.category === "Taxes") counts.tax += 1;
      return counts;
    },
    { transactions: 0, documents: 0, reconciliations: 0, tax: 0 },
  );
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
        "Business checking and savings opening balances plus posted ledger activity. Credit cards and personal accounts are excluded.",
      status: cash.greaterThan(0) ? "positive" : "neutral",
    },
    currentActivity: { income: formatUsd(income), expenses: formatUsd(expenses), unreviewedTransactions, documentAttention },
    isEmptyAccount: cashAccounts.length === 0 && entries.length === 0,
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
      ...taskCounts,
      matches: 0,
      payroll: 0,
      reviewTasks: 0,
    }),
    weeklyReview: review
      ? {
          status: review.status,
          estimatedMinutes: review.estimatedCompletionMinutes,
          tasks,
        }
      : null,
    changes: orderedChanges,
  };
}
