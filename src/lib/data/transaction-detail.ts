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
  notes: string | null;
  amount: string;
  amountDecimal: string;
  direction: "INFLOW" | "OUTFLOW";
  intent: "UNREVIEWED" | "BUSINESS" | "PERSONAL" | "MIXED";
  status: "PENDING_REVIEW" | "APPROVED" | "EXCLUDED" | "CORRECTED" | "VOIDED";
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
  journal: { id: string; entryNumber: string; status: string; categories: string[]; categoryAccountId: string | null; reversal: { id: string; entryNumber: string } | null } | null;
  correction: { original: { id: string; description: string } | null; replacement: { id: string; description: string } | null; reversal: { id: string; entryNumber: string } | null; reason: string | null; events: Array<{ action: string; reason: string | null; occurredAt: string }> };
  correctionEligible: boolean;
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
      notes: true,
      correctionReason: true,
      correctionOf: { select: { id: true, description: true } },
      corrections: { select: { id: true, description: true } },
      correctionReversalJournal: { select: { id: true, entryNumber: true } },
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
      documents: { where: { unlinkedAt: null }, select: { documentId: true } },
      reimbursementExpenses: { select: { id: true } },
      reimbursementPayments: { select: { id: true } },
      journalEntry: {
        select: {
          id: true,
          entryNumber: true,
          status: true,
          accountingPeriod: { select: { status: true } },
          lines: { select: { ledgerAccountId: true, ledgerAccount: { select: { name: true, type: true } } } },
          reversedByEntries: { select: { id: true, entryNumber: true } },
        },
      },
    },
  });
  if (!transaction) return null;
  const events = await prisma.auditEvent.findMany({
    where: { businessId, entityType: "Transaction", entityId: transaction.id, action: { in: ["SUPERSEDE", "CREATE"] } },
    select: { action: true, reason: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
    take: 20,
  });
  const lockedByJournal =
    transaction.journalEntry?.status === "POSTED" ||
    transaction.journalEntry?.status === "REVERSED" ||
    transaction.journalEntry?.accountingPeriod.status === "LOCKED";
  const editable = transaction.status === "PENDING_REVIEW" && !lockedByJournal;
  const lockExplanation = lockedByJournal
    ? "This transaction has posted or reversed accounting impact and is read-only. Eligible posted records can be corrected through a controlled replacement."
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
    notes: transaction.notes,
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
    journal: transaction.journalEntry ? {
      id: transaction.journalEntry.id,
      entryNumber: transaction.journalEntry.entryNumber,
      status: transaction.journalEntry.status,
      categories: [...new Set(transaction.journalEntry.lines.filter((line) => line.ledgerAccount.type !== "ASSET").map((line) => line.ledgerAccount.name))],
      categoryAccountId: transaction.journalEntry.lines.find((line) => line.ledgerAccount.type === "INCOME" || line.ledgerAccount.type === "EXPENSE")?.ledgerAccountId ?? null,
      reversal: transaction.journalEntry.reversedByEntries[0] ?? null,
    } : null,
    correction: { original: transaction.correctionOf, replacement: transaction.corrections[0] ?? null, reversal: transaction.correctionReversalJournal, reason: transaction.correctionReason, events: events.map((event) => ({ action: event.action, reason: event.reason, occurredAt: event.occurredAt.toISOString() })) },
    correctionEligible: transaction.status === "APPROVED" || transaction.status === "EXCLUDED"
      ? transaction.journalEntry?.status === "POSTED" && transaction.journalEntry.reversedByEntries.length === 0 && !transaction.correctionOf && transaction.corrections.length === 0
      : false,
    editable,
    lockExplanation,
  };
}
