import { Prisma } from "../../generated/prisma/client";

export type CashTransaction = {
  amount: Prisma.Decimal;
  direction: "INFLOW" | "OUTFLOW";
  status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "VOIDED";
};

export type CashAccount = {
  openingBalance: Prisma.Decimal;
  isTaxReserve: boolean;
  transactions: CashTransaction[];
};

export type TaxEstimateInput = {
  taxYear: number;
  quarter: number;
  revisionNumber: number;
  projectedTaxLiability: Prisma.Decimal;
  withholdingCredits: Prisma.Decimal;
  priorPayments: Prisma.Decimal;
};

export type TaxPaymentInput = {
  amount: Prisma.Decimal;
  status: "PLANNED" | "RECORDED" | "VOIDED";
};

export function formatUsd(amount: Prisma.Decimal): string {
  const fixed = amount.toFixed(2);
  const negative = fixed.startsWith("-");
  const [whole, cents] = (negative ? fixed.slice(1) : fixed).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}$${grouped}.${cents}`;
}

export function calculateCashBalance(accounts: CashAccount[]): Prisma.Decimal {
  return accounts.reduce((accountTotal, account) => {
    const accountBalance = account.transactions.reduce(
      (balance, transaction) => {
        if (transaction.status !== "APPROVED") {
          return balance;
        }

        return transaction.direction === "INFLOW"
          ? balance.plus(transaction.amount)
          : balance.minus(transaction.amount);
      },
      new Prisma.Decimal(account.openingBalance),
    );

    return accountTotal.plus(accountBalance);
  }, new Prisma.Decimal(0));
}

export function selectLatestTaxEstimate<T extends TaxEstimateInput>(
  estimates: T[],
): T | null {
  return (
    [...estimates].sort(
      (left, right) =>
        right.taxYear - left.taxYear ||
        right.quarter - left.quarter ||
        right.revisionNumber - left.revisionNumber,
    )[0] ?? null
  );
}

export function calculateRemainingTaxObligation(
  estimate: TaxEstimateInput,
  payments: TaxPaymentInput[],
): Prisma.Decimal {
  const recordedPayments = payments.reduce(
    (total, payment) =>
      payment.status === "RECORDED" ? total.plus(payment.amount) : total,
    new Prisma.Decimal(0),
  );
  const remaining = estimate.projectedTaxLiability
    .minus(estimate.withholdingCredits)
    .minus(estimate.priorPayments)
    .minus(recordedPayments);

  return Prisma.Decimal.max(remaining, new Prisma.Decimal(0));
}

export function calculateReservePosition(
  reserve: Prisma.Decimal | null,
  obligation: Prisma.Decimal | null,
): Prisma.Decimal | null {
  if (!reserve || !obligation) {
    return null;
  }

  return reserve.minus(obligation);
}

export function orderReviewTasks<T extends { sortOrder: number; id: string }>(
  tasks: T[],
): T[] {
  return [...tasks].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
}
