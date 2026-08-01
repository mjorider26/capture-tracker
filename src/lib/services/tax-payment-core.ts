import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const version = z.string().regex(/^(?:[1-9]\d{0,8})$/).transform(Number);
const money = z.string().max(19).regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/).refine((value) => new Prisma.Decimal(value).greaterThan(0), "Payment amount must be greater than zero.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)), "Use a valid payment date.");
const key = z.string().trim().max(64).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Use a valid payment intent key.").transform((value) => value.toLowerCase());
export const taxPaymentSchema = z.object({ estimateId: id, expectedVersion: version, amount: money, paidAt: date, confirmationNumber: z.string().trim().max(160).refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Reference contains unsupported characters.").optional().transform((value) => value || null), notes: z.string().trim().max(240).refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Notes contain unsupported characters.").optional().transform((value) => value || null), idempotencyKey: key });
export type TaxActor = { businessId: string; actorUserId: string; actorMembershipId: string; role: BusinessRole; executionMode: "authenticated" | "demo" };
export function paymentTotals(projected: Prisma.Decimal, payments: Array<{ amount: Prisma.Decimal; status: string }>) { const paid = payments.reduce((total, payment) => payment.status === "RECORDED" ? total.plus(payment.amount) : total, new Prisma.Decimal(0)); return { paid, remaining: projected.minus(paid) }; }
