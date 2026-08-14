import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const version = z
  .string()
  .regex(/^(?:[1-9]\d{0,8})$/)
  .transform(Number);
const money = z
  .string()
  .max(19)
  .regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)),
    "Use a valid calendar date.",
  );

export const reconciliationStartSchema = z
  .object({
    accountId: id,
    statementStartDate: date,
    statementEndDate: date,
    statementEndingBalance: money,
  })
  .refine((value) => value.statementEndDate >= value.statementStartDate, {
    path: ["statementEndDate"],
    message: "Statement end date must not precede its start date.",
  });

export const reconciliationSaveSchema = z.object({
  reconciliationId: id,
  expectedVersion: version,
  transactionIds: z.array(id).max(100),
});

export const reconciliationFinalizeSchema = z.object({
  reconciliationId: id,
  expectedVersion: version,
});

export type ReconciliationActor = {
  businessId: string;
  actorUserId: string;
  actorMembershipId: string;
  role: BusinessRole;
  executionMode: "authenticated" | "demo";
};

export type ReconciliationResult =
  | {
      ok: true;
      reconciliationId: string;
      nextVersion: number;
      calculatedBalance: string;
      difference: string;
      status: "DRAFT" | "COMPLETED";
    }
  | {
      ok: false;
      code:
        | "INVALID"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "CONFLICT"
        | "IMMUTABLE"
        | "UNBALANCED";
      message: string;
    };

export function parseReconciliationInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { ok: true; data: z.output<T> } | { ok: false; message: string } {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : {
        ok: false,
        message:
          parsed.error.issues[0]?.message ?? "Reconciliation input is invalid.",
      };
}

/** Difference is statement ending balance minus the selected cleared book balance. */
export function calculateReconciliationBalances(
  openingBalance: Prisma.Decimal | string,
  statementEndingBalance: Prisma.Decimal | string,
  selected: Array<{
    amount: Prisma.Decimal | string;
    direction: "INFLOW" | "OUTFLOW";
  }>,
) {
  const calculatedBalance = selected.reduce(
    (total, transaction) =>
      transaction.direction === "INFLOW"
        ? total.plus(transaction.amount)
        : total.minus(transaction.amount),
    new Prisma.Decimal(openingBalance),
  );
  const difference = new Prisma.Decimal(statementEndingBalance).minus(
    calculatedBalance,
  );
  return { calculatedBalance, difference, balanced: difference.equals(0) };
}

export function isEligibleReconciliationAccount(account: {
  ownership: string;
  type: string;
}) {
  return (
    account.ownership === "BUSINESS" &&
    (account.type === "CHECKING" ||
      account.type === "SAVINGS" ||
      account.type === "CREDIT_CARD")
  );
}

export function evaluateInitialReconciliationReadiness(
  requiredAccountIds: string[],
  completed: Array<{ financialAccountId: string; statementEndDate: Date }>,
) {
  const latestByAccount = new Map<string, Date>();
  for (const item of completed) {
    const current = latestByAccount.get(item.financialAccountId);
    if (!current || item.statementEndDate > current)
      latestByAccount.set(item.financialAccountId, item.statementEndDate);
  }
  const ready =
    requiredAccountIds.length > 0 &&
    requiredAccountIds.every((accountId) => latestByAccount.has(accountId));
  const booksCurrentThrough = ready
    ? requiredAccountIds
        .map((accountId) => latestByAccount.get(accountId)!)
        .reduce((earliest, value) => (value < earliest ? value : earliest))
    : null;
  return { ready, booksCurrentThrough };
}
