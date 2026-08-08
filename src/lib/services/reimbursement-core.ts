import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)), "Use a valid incurred date.");
const money = z.string().max(19).regex(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/).refine((value) => new Prisma.Decimal(value).greaterThan(0), "Amount must be greater than zero.");
const text = (max: number) => z.string().trim().max(max).refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Text contains unsupported characters.");

export const reimbursementExpenseSchema = z.object({
  incurredAt: date,
  amount: money,
  expenseType: z.enum(["MILEAGE", "AIRFARE", "LODGING", "MEALS", "PARKING", "TOLLS", "SUPPLIES", "PHONE", "INTERNET", "EDUCATION", "OTHER"]),
  businessPurpose: text(500).min(3, "Describe the business purpose."),
  merchantName: text(160).optional().transform((value) => value || null),
  notes: text(1000).optional().transform((value) => value || null),
  documentId: id.optional().transform((value) => value || null),
  idempotencyKey: z.string().trim().max(64).regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "Use a valid submission key.").transform((value) => value.toLowerCase()),
});

export type ReimbursementActor = { businessId: string; actorUserId: string; actorMembershipId: string; role: BusinessRole; executionMode: "authenticated" | "demo" };
