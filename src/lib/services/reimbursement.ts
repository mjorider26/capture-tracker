import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { reimbursementExpenseSchema, type ReimbursementActor } from "./reimbursement-core";

type Client = Pick<PrismaClient, "$transaction"> & { reimbursementClaim: PrismaClient["reimbursementClaim"]; reimbursementExpense: PrismaClient["reimbursementExpense"]; document: PrismaClient["document"]; };
export type CreateReimbursementResult = { ok: true; claimId: string; code: "CREATED" | "ALREADY_RECORDED" } | { ok: false; message: string };

export async function createPersonallyPaidReimbursement(client: Client, actor: ReimbursementActor, input: unknown): Promise<CreateReimbursementResult> {
  if (actor.role !== "OWNER") return { ok: false, message: "Only the business owner can create an accountable-plan reimbursement claim." };
  const parsed = reimbursementExpenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Reimbursement input is invalid." };
  const data = parsed.data;
  const existing = await client.reimbursementClaim.findFirst({ where: { businessId: actor.businessId, notes: { contains: `submission:${data.idempotencyKey}` } }, select: { id: true } });
  if (existing) return { ok: true, claimId: existing.id, code: "ALREADY_RECORDED" };
  try {
    return await client.$transaction(async (tx) => {
      if (data.documentId) {
        const document = await tx.document.findFirst({ where: { id: data.documentId, businessId: actor.businessId, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true } });
        if (!document) return { ok: false as const, message: "The supporting document is unavailable." };
      }
      const replay = await tx.reimbursementClaim.findFirst({ where: { businessId: actor.businessId, notes: { contains: `submission:${data.idempotencyKey}` } }, select: { id: true } });
      if (replay) return { ok: true as const, claimId: replay.id, code: "ALREADY_RECORDED" as const };
      const claim = await tx.reimbursementClaim.create({ data: { businessId: actor.businessId, claimantMembershipId: actor.actorUserId, totalAmount: new Prisma.Decimal(data.amount), notes: `${data.notes ? `${data.notes}\n` : ""}submission:${data.idempotencyKey}` } });
      await tx.reimbursementExpense.create({ data: { businessId: actor.businessId, claimId: claim.id, expenseType: data.expenseType, documentId: data.documentId, incurredAt: new Date(`${data.incurredAt}T12:00:00.000Z`), amount: new Prisma.Decimal(data.amount), businessPurpose: data.businessPurpose, merchantName: data.merchantName } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "ReimbursementClaim", entityId: claim.id, afterJson: { status: "DRAFT", amount: data.amount, personallyPaid: true, hasSupportingDocument: Boolean(data.documentId) }, metadataJson: { executionMode: actor.executionMode, reimbursementSubmission: true } } });
      return { ok: true as const, claimId: claim.id, code: "CREATED" as const };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "This reimbursement could not be recorded safely. Refresh and try again." };
    return { ok: false, message: "This reimbursement could not be recorded safely. Refresh and try again." };
  }
}
