import { Prisma } from "../../generated/prisma/client";

import { formatUsd } from "./today-dashboard-core";

export type MoneyFilter = {
  query: string;
  status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "VOIDED" | "";
  intent: "UNREVIEWED" | "BUSINESS" | "PERSONAL" | "MIXED" | "";
  accountId: string;
};

export type MoneyTransactionInput = {
  id: string;
  amount: Prisma.Decimal;
  direction: "INFLOW" | "OUTFLOW";
  intent: "UNREVIEWED" | "BUSINESS" | "PERSONAL" | "MIXED";
  status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "VOIDED";
};

export function emptyMoneyFilter(): MoneyFilter {
  return { query: "", status: "", intent: "", accountId: "" };
}

const filterValues = {
  status: new Set(["PENDING_REVIEW", "APPROVED", "EXCLUDED", "VOIDED"]),
  intent: new Set(["UNREVIEWED", "BUSINESS", "PERSONAL", "MIXED"]),
};

export function parseMoneyFilter(input: Record<string, string | string[] | undefined>): MoneyFilter {
  const fallback = emptyMoneyFilter();
  const get = (name: string) => typeof input[name] === "string" ? input[name].trim() : "";
  const query = get("q").slice(0, 120);
  const status = get("status");
  const intent = get("intent");
  return {
    query,
    status: filterValues.status.has(status) ? status as MoneyFilter["status"] : fallback.status,
    intent: filterValues.intent.has(intent) ? intent as MoneyFilter["intent"] : fallback.intent,
    accountId: get("account").slice(0, 191),
  };
}

export function buildMoneySummary(transactions: MoneyTransactionInput[]) {
  const active = transactions.filter(
    (transaction) => transaction.status !== "VOIDED",
  );
  const reviewedBusiness = active
    .filter(
      (transaction) =>
        transaction.intent === "BUSINESS" && transaction.status === "APPROVED",
    )
    .reduce(
      (total, transaction) => total.plus(transaction.amount),
      new Prisma.Decimal(0),
    );
  const excludedPersonal = active
    .filter(
      (transaction) =>
        transaction.intent === "PERSONAL" && transaction.status === "EXCLUDED",
    )
    .reduce(
      (total, transaction) => total.plus(transaction.amount),
      new Prisma.Decimal(0),
    );

  return {
    awaitingReviewCount: active.filter(
      (transaction) => transaction.status === "PENDING_REVIEW",
    ).length,
    reviewedBusinessAmount: formatUsd(reviewedBusiness),
    excludedPersonalAmount: formatUsd(excludedPersonal),
    mixedCount: active.filter((transaction) => transaction.intent === "MIXED")
      .length,
  };
}

export function serializeMoneyAmount(amount: Prisma.Decimal): string {
  return formatUsd(amount);
}
