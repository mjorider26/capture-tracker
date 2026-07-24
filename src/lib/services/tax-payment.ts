import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { taxPaymentSchema, type TaxActor } from "./tax-payment-core";
type Client = Pick<PrismaClient, "$transaction"> & {
  taxPaymentRecord: PrismaClient["taxPaymentRecord"];
  quarterlyTaxEstimate: PrismaClient["quarterlyTaxEstimate"];
};
export type TaxPaymentResult =
  | {
      ok: true;
      code: "CREATED" | "ALREADY_RECORDED";
      paymentId: string;
      nextVersion: number;
    }
  | {
      ok: false;
      code:
        | "INVALID"
        | "NOT_FOUND"
        | "FORBIDDEN"
        | "STALE_VERSION"
        | "FUTURE_VERSION"
        | "IDEMPOTENCY_CONFLICT"
        | "SAFE_FAILURE";
      message: string;
    };
export async function recordTaxPayment(
  client: Client,
  actor: TaxActor,
  input: unknown,
): Promise<TaxPaymentResult> {
  if (actor.role !== "OWNER")
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only business owners can record tax payments.",
    };
  const parsed = taxPaymentSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "Payment input is invalid.",
    };
  const data = parsed.data;
  const replay = await client.taxPaymentRecord.findFirst({
    where: {
      businessId: actor.businessId,
      estimateId: data.estimateId,
      idempotencyKey: data.idempotencyKey,
    },
    select: { id: true, amount: true, paidAt: true, notes: true },
  });
  if (replay) {
    const exact =
      replay.amount.equals(data.amount) &&
      replay.paidAt?.toISOString().slice(0, 10) === data.paidAt &&
      (replay.notes ?? null) === data.notes;
    return exact
      ? {
          ok: true,
          code: "ALREADY_RECORDED",
          paymentId: replay.id,
          nextVersion: data.expectedVersion,
        }
      : {
          ok: false,
          code: "IDEMPOTENCY_CONFLICT",
          message:
            "This payment intent key was already used with different facts.",
        };
  }
  try {
    return await client.$transaction(async (tx) => {
      const estimate = await tx.quarterlyTaxEstimate.findFirst({
        where: {
          id: data.estimateId,
          businessId: actor.businessId,
          status: { notIn: ["VOIDED", "SUPERSEDED"] },
        },
        select: {
          id: true,
          version: true,
          taxYear: true,
          quarter: true,
          jurisdictionType: true,
          jurisdictionCode: true,
        },
      });
      if (!estimate)
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Tax estimate not found.",
        };
      await tx.$executeRawUnsafe("SAVEPOINT payment_insert");
      let payment;
      try {
        payment = await tx.taxPaymentRecord.create({
          data: {
            businessId: actor.businessId,
            estimateId: estimate.id,
            jurisdictionType: estimate.jurisdictionType,
            jurisdictionCode: estimate.jurisdictionCode,
            taxYear: estimate.taxYear,
            quarter: estimate.quarter,
            amount: data.amount,
            status: "RECORDED",
            paidAt: new Date(`${data.paidAt}T12:00:00.000Z`),
            notes: data.notes,
            idempotencyKey: data.idempotencyKey,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT payment_insert");
          const existing = await tx.taxPaymentRecord.findFirst({
            where: {
              businessId: actor.businessId,
              estimateId: estimate.id,
              idempotencyKey: data.idempotencyKey,
            },
            select: { id: true, amount: true, paidAt: true, notes: true },
          });
          if (existing) {
            const exact =
              existing.amount.equals(data.amount) &&
              existing.paidAt?.toISOString().slice(0, 10) === data.paidAt &&
              (existing.notes ?? null) === data.notes;
            return exact
              ? {
                  ok: true as const,
                  code: "ALREADY_RECORDED" as const,
                  paymentId: existing.id,
                  nextVersion: estimate.version,
                }
              : {
                  ok: false as const,
                  code: "IDEMPOTENCY_CONFLICT" as const,
                  message:
                    "This payment intent key was already used with different facts.",
                };
          }
        }
        throw error;
      }
      const gate = await tx.quarterlyTaxEstimate.updateMany({
        where: {
          id: estimate.id,
          businessId: actor.businessId,
          version: data.expectedVersion,
          status: { notIn: ["VOIDED", "SUPERSEDED"] },
        },
        data: { version: { increment: 1 } },
      });
      if (gate.count !== 1) throw new Error("PAYMENT_VERSION_CONFLICT");
      await tx.auditEvent.create({
        data: {
          actorType: "USER",
          businessId: actor.businessId,
          actorMembershipId: actor.actorUserId,
          action: "CREATE",
          entityType: "TaxPaymentRecord",
          entityId: payment.id,
          afterJson: {
            estimateId: estimate.id,
            amount: new Prisma.Decimal(data.amount).toFixed(2),
            paidAt: data.paidAt,
          },
          metadataJson: {
            executionMode: actor.executionMode,
            taxPayment: true,
            estimateId: estimate.id,
            previousVersion: estimate.version,
            nextVersion: estimate.version + 1,
          },
        },
      });
      return {
        ok: true,
        code: "CREATED",
        paymentId: payment.id,
        nextVersion: estimate.version + 1,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await client.taxPaymentRecord.findFirst({
        where: {
          businessId: actor.businessId,
          estimateId: data.estimateId,
          idempotencyKey: data.idempotencyKey,
        },
        select: { id: true, amount: true, paidAt: true, notes: true },
      });
      if (existing) {
        const exact =
          existing.amount.equals(data.amount) &&
          existing.paidAt?.toISOString().slice(0, 10) === data.paidAt &&
          (existing.notes ?? null) === data.notes;
        return exact
          ? {
              ok: true,
              code: "ALREADY_RECORDED",
              paymentId: existing.id,
              nextVersion: data.expectedVersion,
            }
          : {
              ok: false,
              code: "IDEMPOTENCY_CONFLICT",
              message:
                "This payment intent key was already used with different facts.",
            };
      }
    }
    if (
      error instanceof Error &&
      error.message === "PAYMENT_VERSION_CONFLICT"
    ) {
      const current = await client.quarterlyTaxEstimate.findFirst({
        where: { id: data.estimateId, businessId: actor.businessId },
        select: { version: true },
      });
      const actualVersion = current?.version;
      if (actualVersion !== undefined && data.expectedVersion < actualVersion) {
        return {
          ok: false,
          code: "STALE_VERSION",
          message:
            "This estimate changed since it was opened. Refresh before recording a payment.",
        };
      }
      if (actualVersion !== undefined && data.expectedVersion > actualVersion) {
        return {
          ok: false,
          code: "FUTURE_VERSION",
          message:
            "This form has a version that is newer than the recorded estimate. Refresh before recording a payment.",
        };
      }
      return {
        ok: false,
        code: "SAFE_FAILURE",
        message:
          "The payment could not be recorded safely. Refresh and try again.",
      };
    }
    return {
      ok: false,
      code: "SAFE_FAILURE",
      message: "The payment could not be recorded safely.",
    };
  }
}
