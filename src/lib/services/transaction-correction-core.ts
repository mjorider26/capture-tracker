import { Prisma } from "../../generated/prisma/client";
import { z } from "zod";

import { parseTransactionDate } from "./manual-transaction-core";

const version = z.string().regex(/^(?:0|[1-9]\d{0,8})$/).transform(Number);
const correctionKey = z.string().trim().max(64).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "This correction form has expired. Refresh and try again.").transform((value) => value.toLowerCase());
const reason = z.string().trim().min(1, "Provide a correction reason.").max(240, "Correction reason is too long.").refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Correction reason contains unsupported characters.");

const money = z.string().max(19).regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/, "Enter an exact amount with no more than two decimals.").refine((value) => new Prisma.Decimal(value).greaterThan(0), "Amount must be greater than zero.");
const text = (max: number, label: string, required = false) => z.string().trim().max(max, `${label} is too long.`).refine((value) => !/[\x00-\x1F\x7F]/.test(value), `${label} contains unsupported characters.`).refine((value) => !required || value.length > 0, `${label} is required.`).transform((value) => value || null);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);

export const transactionCorrectionSchema = z.object({
  transactionId: identifier,
  expectedVersion: version,
  correctionKey,
  correctionReason: reason,
  transactionType: z.enum(["INCOME", "BUSINESS_EXPENSE", "PERSONAL", "MIXED"]),
  transactionDate: z.string().refine((value) => parseTransactionDate(value) !== null, "Use a valid transaction date."),
  amount: money,
  merchantOrPayer: text(160, "Merchant or payer", true),
  description: text(500, "Description", true),
  categoryAccountId: identifier.optional(),
  cashDirection: z.enum(["INFLOW", "OUTFLOW"]).optional(),
  reference: text(160, "Reference").optional().transform((value) => value ?? null),
  notes: text(1_000, "Notes").optional().transform((value) => value ?? null),
  businessAmount: money.optional(),
  personalAmount: money.optional(),
}).superRefine((value, context) => {
  const needsCategory = value.transactionType === "INCOME" || value.transactionType === "BUSINESS_EXPENSE" || value.transactionType === "MIXED";
  if (needsCategory && !value.categoryAccountId) context.addIssue({ code: "custom", path: ["categoryAccountId"], message: "Choose a business category." });
  if ((value.transactionType === "PERSONAL" || value.transactionType === "MIXED") && !value.cashDirection) context.addIssue({ code: "custom", path: ["cashDirection"], message: "Choose whether cash came in or went out." });
  if (value.transactionType === "MIXED") {
    if (!value.businessAmount || !value.personalAmount) context.addIssue({ code: "custom", path: ["businessAmount"], message: "Enter both business and personal amounts." });
    else if (!new Prisma.Decimal(value.businessAmount).plus(value.personalAmount).equals(value.amount)) context.addIssue({ code: "custom", path: ["businessAmount"], message: "Business and personal amounts must equal the total exactly." });
  }
});

export type TransactionCorrectionInput = z.output<typeof transactionCorrectionSchema>;

export function correctionJournalLines(input: TransactionCorrectionInput, accounts: { cashAccountId: string; categoryAccountId: string | null; contributionsAccountId: string | null; distributionsAccountId: string | null }) {
  const total = new Prisma.Decimal(input.amount).toFixed(2);
  const businessAmount = input.businessAmount ? new Prisma.Decimal(input.businessAmount).toFixed(2) : null;
  const personalAmount = input.personalAmount ? new Prisma.Decimal(input.personalAmount).toFixed(2) : null;
  const debit = (ledgerAccountId: string, amount: string, memo: string) => ({ ledgerAccountId, debitAmount: amount, creditAmount: "0", memo });
  const credit = (ledgerAccountId: string, amount: string, memo: string) => ({ ledgerAccountId, debitAmount: "0", creditAmount: amount, memo });
  const direction = input.transactionType === "INCOME" ? "INFLOW" : input.transactionType === "BUSINESS_EXPENSE" ? "OUTFLOW" : input.cashDirection!;
  if (input.transactionType === "INCOME") return [debit(accounts.cashAccountId, total, "Corrected income deposit"), credit(accounts.categoryAccountId!, total, "Corrected income category")];
  if (input.transactionType === "BUSINESS_EXPENSE") return [debit(accounts.categoryAccountId!, total, "Corrected business expense category"), credit(accounts.cashAccountId, total, "Corrected business expense")];
  if (input.transactionType === "PERSONAL") return direction === "INFLOW"
    ? [debit(accounts.cashAccountId, total, "Corrected owner contribution"), credit(accounts.contributionsAccountId!, total, "Corrected owner contribution")]
    : [debit(accounts.distributionsAccountId!, total, "Corrected owner distribution"), credit(accounts.cashAccountId, total, "Corrected owner distribution")];
  return direction === "INFLOW"
    ? [debit(accounts.cashAccountId, total, "Corrected mixed deposit"), credit(accounts.categoryAccountId!, businessAmount!, "Corrected business income portion"), credit(accounts.contributionsAccountId!, personalAmount!, "Corrected personal contribution portion")]
    : [debit(accounts.categoryAccountId!, businessAmount!, "Corrected business expense portion"), debit(accounts.distributionsAccountId!, personalAmount!, "Corrected personal distribution portion"), credit(accounts.cashAccountId, total, "Corrected mixed payment")];
}

export { parseTransactionDate };
