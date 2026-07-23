import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "../prisma";
import { serializeMoneyAmount } from "./money-dashboard-core";

const transactionIdPattern = /^[A-Za-z0-9_-]{1,191}$/;

export function isValidTransactionId(value: string): boolean {
  return transactionIdPattern.test(value);
}

export type TransactionDetail = {
  id: string;
  postedAt: string;
  description: string;
  merchantName: string | null;
  sourceReference: string | null;
  amount: string;
  amountDecimal: string;
  direction: "INFLOW" | "OUTFLOW";
  intent: "UNREVIEWED" | "BUSINESS" | "PERSONAL" | "MIXED";
  status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "VOIDED";
  version: number;
  account: { name: string; ownership: "BUSINESS" | "PERSONAL"; type: string };
  splits: Array<{
    id: string;
    intent: "BUSINESS" | "PERSONAL";
    amount: string;
    memo: string | null;
  }>;
  documentCount: number;
  reimbursementCount: number;
  journalStatus: string | null;
  editable: boolean;
  lockExplanation: string | null;
};

export async function getTransactionDetailForBusiness(
  businessId: string,
  transactionId: string,
): Promise<TransactionDetail | null> {
  noStore();
  if (!isValidTransactionId(transactionId)) return null;
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, businessId },
    select: {
      id: true,
      postedAt: true,
      description: true,
      merchantName: true,
      sourceReference: true,
      amount: true,
      direction: true,
      intent: true,
      status: true,
      version: true,
      account: { select: { name: true, ownership: true, type: true } },
      splits: {
        orderBy: [{ intent: "asc" }, { id: "asc" }],
        select: { id: true, intent: true, amount: true, memo: true },
      },
      documents: { select: { documentId: true } },
      reimbursementExpenses: { select: { id: true } },
      reimbursementPayments: { select: { id: true } },
      journalEntry: {
        select: {
          status: true,
          accountingPeriod: { select: { status: true } },
        },
      },
    },
  });
  if (!transaction) return null;
  const lockedByJournal =
    transaction.journalEntry?.status === "POSTED" ||
    transaction.journalEntry?.status === "REVERSED" ||
    transaction.journalEntry?.accountingPeriod.status === "LOCKED";
  const editable = transaction.status === "PENDING_REVIEW" && !lockedByJournal;
  const lockExplanation = lockedByJournal
    ? "This transaction has posted or reversed accounting impact, or belongs to a locked period. It must be corrected through a future reversal workflow."
    : transaction.status === "VOIDED"
      ? "Voided transactions are historical records and cannot be reviewed."
      : transaction.status !== "PENDING_REVIEW"
        ? "This transaction has already been reviewed and is retained as a read-only record."
        : null;
  return {
    id: transaction.id,
    postedAt: transaction.postedAt.toISOString(),
    description: transaction.description,
    merchantName: transaction.merchantName,
    sourceReference: transaction.sourceReference,
    amount: serializeMoneyAmount(transaction.amount),
    amountDecimal: transaction.amount.toFixed(2),
    direction: transaction.direction,
    intent: transaction.intent,
    status: transaction.status,
    version: transaction.version,
    account: transaction.account,
    splits: transaction.splits.map((split) => ({
      id: split.id,
      intent: split.intent as "BUSINESS" | "PERSONAL",
      amount: split.amount.toFixed(2),
      memo: split.memo,
    })),
    documentCount: transaction.documents.length,
    reimbursementCount:
      transaction.reimbursementExpenses.length +
      transaction.reimbursementPayments.length,
    journalStatus: transaction.journalEntry?.status ?? null,
    editable,
    lockExplanation,
  };
}
