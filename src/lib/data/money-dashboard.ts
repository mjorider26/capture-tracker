import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "../prisma";
import {
  buildMoneySummary,
  emptyMoneyFilter,
  serializeMoneyAmount,
  type MoneyFilter,
} from "./money-dashboard-core";

export type MoneyDashboard = {
  businessName: string;
  summary: ReturnType<typeof buildMoneySummary> & {
    resultCount: number;
    accountCount: number;
  };
  filters: MoneyFilter;
  accounts: Array<{ id: string; name: string }>;
  transactions: Array<{
    id: string;
    postedAt: string;
    description: string;
    accountName: string;
    accountOwnership: "BUSINESS" | "PERSONAL";
    amount: string;
    direction: "INFLOW" | "OUTFLOW";
    intent: "UNREVIEWED" | "BUSINESS" | "PERSONAL" | "MIXED";
    status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "VOIDED";
    isMixed: boolean;
    hasDocuments: boolean;
    isLocked: boolean;
  }>;
};

const filterValues = {
  status: new Set(["PENDING_REVIEW", "APPROVED", "EXCLUDED", "VOIDED"]),
  intent: new Set(["UNREVIEWED", "BUSINESS", "PERSONAL", "MIXED"]),
};

export function parseMoneyFilter(
  input: Record<string, string | string[] | undefined>,
): MoneyFilter {
  const fallback = emptyMoneyFilter();
  const get = (name: string) => {
    const value = input[name];
    return typeof value === "string" ? value.trim() : "";
  };
  const query = get("q").slice(0, 120);
  const status = get("status");
  const intent = get("intent");
  const accountId = get("account").slice(0, 191);
  return {
    query,
    status: filterValues.status.has(status)
      ? (status as MoneyFilter["status"])
      : fallback.status,
    intent: filterValues.intent.has(intent)
      ? (intent as MoneyFilter["intent"])
      : fallback.intent,
    accountId,
  };
}

// The businessId argument is accepted only from server-side context resolution.
export async function getMoneyDashboard(
  businessId: string,
  rawFilters: Record<string, string | string[] | undefined> = {},
): Promise<MoneyDashboard> {
  noStore();
  const filters = parseMoneyFilter(rawFilters);
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { displayName: true },
  });
  const accounts = await prisma.financialAccount.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  const allTransactions = await prisma.transaction.findMany({
    where: { businessId },
    select: {
      id: true,
      amount: true,
      direction: true,
      intent: true,
      status: true,
    },
  });
  const transactions = await prisma.transaction.findMany({
    where: {
      businessId,
      ...(filters.query
        ? {
            OR: [
              { description: { contains: filters.query, mode: "insensitive" } },
              {
                merchantName: { contains: filters.query, mode: "insensitive" },
              },
              {
                sourceReference: {
                  contains: filters.query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.intent ? { intent: filters.intent } : {}),
      ...(filters.accountId ? { accountId: filters.accountId } : {}),
    },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: 75,
    select: {
      id: true,
      postedAt: true,
      description: true,
      amount: true,
      direction: true,
      intent: true,
      status: true,
      account: { select: { name: true, ownership: true } },
      documents: { select: { documentId: true }, take: 1 },
      journalEntry: {
        select: {
          status: true,
          accountingPeriod: { select: { status: true } },
        },
      },
    },
  });
  const summary = buildMoneySummary(allTransactions);

  return {
    businessName: business.displayName,
    summary: {
      ...summary,
      resultCount: transactions.length,
      accountCount: accounts.length,
    },
    filters,
    accounts,
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      postedAt: transaction.postedAt.toISOString(),
      description: transaction.description,
      accountName: transaction.account.name,
      accountOwnership: transaction.account.ownership,
      amount: serializeMoneyAmount(transaction.amount),
      direction: transaction.direction,
      intent: transaction.intent,
      status: transaction.status,
      isMixed: transaction.intent === "MIXED",
      hasDocuments: transaction.documents.length > 0,
      isLocked:
        transaction.status === "VOIDED" ||
        transaction.journalEntry?.status === "POSTED" ||
        transaction.journalEntry?.status === "REVERSED" ||
        transaction.journalEntry?.accountingPeriod.status === "LOCKED",
    })),
  };
}
