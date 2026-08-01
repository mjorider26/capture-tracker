import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const moneyPattern = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const money = z
  .string()
  .max(19)
  .regex(moneyPattern, "Enter an exact amount with no more than two decimals.")
  .refine((value) => !moneyPattern.test(value) || new Prisma.Decimal(value).greaterThan(0), "Amount must be greater than zero.");
const idempotencyKey = z
  .string()
  .trim()
  .max(64)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "This transaction form has expired. Refresh and try again.",
  )
  .transform((value) => value.toLowerCase());

export function parseTransactionDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

const date = z
  .string()
  .refine((value) => parseTransactionDate(value) !== null, "Use a valid transaction date.");
const plainText = (max: number, label: string, required = false) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long.`)
    .refine((value) => !/[\x00-\x1F\x7F]/.test(value), `${label} contains unsupported characters.`)
    .refine((value) => !required || value.length > 0, `${label} is required.`)
    .transform((value) => value || null);

export const manualTransactionSchema = z
  .object({
    transactionType: z.enum(["INCOME", "BUSINESS_EXPENSE", "PERSONAL", "MIXED"]),
    transactionDate: date,
    amount: money,
    merchantOrPayer: plainText(160, "Merchant or payer", true),
    description: plainText(500, "Description", true),
    financialAccountId: identifier,
    categoryAccountId: identifier.optional(),
    cashDirection: z.enum(["INFLOW", "OUTFLOW"]).optional(),
    reference: plainText(160, "Reference").optional().transform((value) => value ?? null),
    notes: plainText(1_000, "Notes").optional().transform((value) => value ?? null),
    businessAmount: money.optional(),
    personalAmount: money.optional(),
    idempotencyKey,
  })
  .superRefine((value, context) => {
    const needsCategory = value.transactionType === "INCOME" || value.transactionType === "BUSINESS_EXPENSE" || value.transactionType === "MIXED";
    if (needsCategory && !value.categoryAccountId) {
      context.addIssue({ code: "custom", path: ["categoryAccountId"], message: "Choose a business category." });
    }
    if ((value.transactionType === "PERSONAL" || value.transactionType === "MIXED") && !value.cashDirection) {
      context.addIssue({ code: "custom", path: ["cashDirection"], message: "Choose whether cash came in or went out." });
    }
    if (value.transactionType === "MIXED") {
      if (!value.businessAmount || !value.personalAmount) {
        context.addIssue({ code: "custom", path: ["businessAmount"], message: "Enter both business and personal amounts." });
      } else if (!new Prisma.Decimal(value.businessAmount).plus(value.personalAmount).equals(value.amount)) {
        context.addIssue({ code: "custom", path: ["businessAmount"], message: "Business and personal amounts must equal the total exactly." });
      }
    }
  });

export type ManualTransactionActor = {
  businessId: string;
  actorUserId: string;
  actorMembershipId: string;
  role: BusinessRole;
  executionMode: "authenticated" | "demo";
};

export type ManualTransactionInput = z.output<typeof manualTransactionSchema>;

export function accountingForManualTransaction(input: ManualTransactionInput) {
  const direction = input.transactionType === "INCOME" ? "INFLOW" : input.transactionType === "BUSINESS_EXPENSE" ? "OUTFLOW" : input.cashDirection!;
  const intent = input.transactionType === "PERSONAL" ? "PERSONAL" : input.transactionType === "MIXED" ? "MIXED" : "BUSINESS";
  const status = intent === "PERSONAL" ? "EXCLUDED" : "APPROVED";
  const categoryType = direction === "INFLOW" ? "INCOME" : "EXPENSE";
  return { direction, intent, status, categoryType } as const;
}

export function manualJournalLines({
  total,
  transactionType,
  direction,
  cashAccountId,
  categoryAccountId,
  contributionsAccountId,
  distributionsAccountId,
  businessAmount,
  personalAmount,
}: {
  total: string;
  transactionType: ManualTransactionInput["transactionType"];
  direction: "INFLOW" | "OUTFLOW";
  cashAccountId: string;
  categoryAccountId: string | null;
  contributionsAccountId: string | null;
  distributionsAccountId: string | null;
  businessAmount: string | null;
  personalAmount: string | null;
}) {
  const debit = (ledgerAccountId: string, amount: string, memo: string) => ({ ledgerAccountId, debitAmount: amount, creditAmount: "0", memo });
  const credit = (ledgerAccountId: string, amount: string, memo: string) => ({ ledgerAccountId, debitAmount: "0", creditAmount: amount, memo });
  if (transactionType === "INCOME") return [debit(cashAccountId, total, "Manual income deposit"), credit(categoryAccountId!, total, "Income category")];
  if (transactionType === "BUSINESS_EXPENSE") return [debit(categoryAccountId!, total, "Business expense category"), credit(cashAccountId, total, "Manual business expense")];
  if (transactionType === "PERSONAL") return direction === "INFLOW"
    ? [debit(cashAccountId, total, "Owner contribution"), credit(contributionsAccountId!, total, "Owner contribution")]
    : [debit(distributionsAccountId!, total, "Owner distribution"), credit(cashAccountId, total, "Owner distribution")];
  return direction === "INFLOW"
    ? [debit(cashAccountId, total, "Mixed deposit"), credit(categoryAccountId!, businessAmount!, "Business income portion"), credit(contributionsAccountId!, personalAmount!, "Personal contribution portion")]
    : [debit(categoryAccountId!, businessAmount!, "Business expense portion"), debit(distributionsAccountId!, personalAmount!, "Personal distribution portion"), credit(cashAccountId, total, "Mixed payment")];
}
