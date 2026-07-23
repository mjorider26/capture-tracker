import {
  Prisma,
  type BusinessRole,
  type PrismaClient,
} from "../../generated/prisma/client";
import { z } from "zod";

const decimalString = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const transactionId = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const version = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,8})$/)
  .transform(Number)
  .refine((value) => value <= 2_147_483_647);
const positiveMoney = z
  .string()
  .max(19)
  .regex(decimalString)
  .refine(
    (value) =>
      !decimalString.test(value) || new Prisma.Decimal(value).greaterThan(0),
    "Split amounts must be greater than zero.",
  );

export const reviewSubmissionSchema = z
  .object({
    transactionId,
    expectedVersion: version,
    intent: z.enum(["BUSINESS", "PERSONAL", "MIXED"]),
    splits: z
      .array(
        z.object({
          intent: z.enum(["BUSINESS", "PERSONAL"]),
          amount: positiveMoney,
          memo: z
            .string()
            .trim()
            .max(250)
            .optional()
            .transform((value) => value || null),
        }),
      )
      .max(12),
  })
  .superRefine((value, context) => {
    if (value.intent === "MIXED" && value.splits.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["splits"],
        message: "Mixed reviews require at least two non-zero splits.",
      });
    }
    if (value.intent !== "MIXED" && value.splits.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["splits"],
        message: "Only mixed reviews can include splits.",
      });
    }
  });

export type ReviewActorContext = {
  businessId: string;
  actorUserId: string;
  actorMembershipId: string;
  role: BusinessRole;
  executionMode: "authenticated" | "demo";
};

export type ReviewResult =
  | { ok: true; nextVersion: number }
  | {
      ok: false;
      code: "INVALID" | "NOT_FOUND" | "FORBIDDEN" | "LOCKED" | "CONFLICT";
      message: string;
    };

export function validateReviewSubmission(
  input: unknown,
):
  | { ok: true; data: z.output<typeof reviewSubmissionSchema> }
  | { ok: false; message: string } {
  const parsed = reviewSubmissionSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Review input is invalid.",
    };
  return { ok: true, data: parsed.data };
}

export function splitTotalEqualsParent(
  splits: Array<{ amount: string }>,
  parentAmount: Prisma.Decimal,
): boolean {
  return splits
    .reduce((total, split) => total.plus(split.amount), new Prisma.Decimal(0))
    .equals(parentAmount);
}

export function reviewOutcomeForIntent(
  intent: "BUSINESS" | "PERSONAL" | "MIXED",
) {
  return {
    intent,
    status: intent === "PERSONAL" ? "EXCLUDED" : "APPROVED",
  } as const;
}

export function isTransactionReviewLocked({
  status,
  journalStatus,
  accountingPeriodStatus,
}: {
  status: string;
  journalStatus: string | null;
  accountingPeriodStatus: string | null;
}): boolean {
  return (
    status !== "PENDING_REVIEW" ||
    journalStatus === "POSTED" ||
    journalStatus === "REVERSED" ||
    accountingPeriodStatus === "LOCKED"
  );
}

type ReviewClient = Pick<PrismaClient, "$transaction">;

// All scope and actor fields must be assembled by a server-side route wrapper.
export async function reviewTransaction(
  client: ReviewClient,
  actor: ReviewActorContext,
  input: unknown,
): Promise<ReviewResult> {
  if (actor.role !== "OWNER")
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only business owners can review transactions.",
    };
  const validation = validateReviewSubmission(input);
  if (!validation.ok)
    return { ok: false, code: "INVALID", message: validation.message };
  const submission = validation.data;

  try {
    return await client.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: { id: submission.transactionId, businessId: actor.businessId },
        select: {
          id: true,
          businessId: true,
          amount: true,
          intent: true,
          status: true,
          version: true,
          splits: { select: { intent: true, amount: true, memo: true } },
          journalEntry: {
            select: {
              status: true,
              accountingPeriod: { select: { status: true } },
            },
          },
        },
      });
      if (!transaction)
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Transaction not found.",
        };
      if (transaction.version !== submission.expectedVersion) {
        return {
          ok: false,
          code: "CONFLICT",
          message:
            "This transaction changed before your review was saved. Refresh and try again.",
        };
      }
      if (
        isTransactionReviewLocked({
          status: transaction.status,
          journalStatus: transaction.journalEntry?.status ?? null,
          accountingPeriodStatus:
            transaction.journalEntry?.accountingPeriod.status ?? null,
        })
      ) {
        return {
          ok: false,
          code: "LOCKED",
          message:
            "This transaction is read-only because it is historical, posted, or already reviewed.",
        };
      }
      if (
        submission.intent === "MIXED" &&
        !splitTotalEqualsParent(submission.splits, transaction.amount)
      ) {
        return {
          ok: false,
          code: "INVALID",
          message:
            "Mixed split amounts must equal the transaction amount exactly.",
        };
      }

      await tx.transactionSplit.deleteMany({
        where: { businessId: actor.businessId, transactionId: transaction.id },
      });
      const outcome = reviewOutcomeForIntent(submission.intent);
      const update = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          businessId: actor.businessId,
          version: submission.expectedVersion,
        },
        data: {
          intent: outcome.intent,
          status: outcome.status,
          approvedAt: new Date(),
          // This relationship is keyed by businessId + userId despite the historical field name.
          approvedByMembershipId: actor.actorUserId,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1)
        throw new Error("Optimistic transaction update conflict.");
      // Parent intent changes before the replacement rows so the deferred trigger observes the final mixed state at commit.
      if (submission.intent === "MIXED") {
        await tx.transactionSplit.createMany({
          data: submission.splits.map((split) => ({
            businessId: actor.businessId,
            transactionId: transaction.id,
            intent: split.intent,
            amount: split.amount,
            memo: split.memo,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          actorType: "USER",
          businessId: actor.businessId,
          actorMembershipId: actor.actorUserId,
          action: "UPDATE",
          entityType: "Transaction",
          entityId: transaction.id,
          beforeJson: {
            intent: transaction.intent,
            status: transaction.status,
            version: transaction.version,
            splits: transaction.splits.map((split) => ({
              intent: split.intent,
              amount: split.amount.toFixed(2),
              memo: split.memo,
            })),
          },
          afterJson: {
            intent: outcome.intent,
            status: outcome.status,
            version: transaction.version + 1,
            splits: submission.splits.map((split) => ({
              intent: split.intent,
              amount: new Prisma.Decimal(split.amount).toFixed(2),
              memo: split.memo,
            })),
          },
          metadataJson: {
            executionMode: actor.executionMode,
            review: true,
            splitCount: submission.splits.length,
          },
        },
      });
      return { ok: true, nextVersion: transaction.version + 1 };
    });
  } catch {
    return {
      ok: false,
      code: "INVALID",
      message: "The review could not be saved safely. Refresh and try again.",
    };
  }
}
