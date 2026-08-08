import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { classificationMatchesDirection, ownerTransferSchema } from "./owner-transfer-core";
import type { ReimbursementActor } from "./reimbursement-core";
type Client = Pick<PrismaClient, "$transaction"> & { externalTransaction: PrismaClient["externalTransaction"]; ownerMoneyTransfer: PrismaClient["ownerMoneyTransfer"]; };
export async function classifyOwnerTransfer(client: Client, actor: ReimbursementActor, input: unknown): Promise<{ ok: true; transferId: string } | { ok: false; message: string }> {
  if (actor.role !== "OWNER") return { ok: false, message: "Only the business owner can classify owner transfers." };
  const parsed = ownerTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Transfer classification is invalid." };
  const data = parsed.data;
  if (!classificationMatchesDirection(data.direction, data.classification)) return { ok: false, message: "That treatment does not match the selected transfer direction." };
  try { return await client.$transaction(async (tx) => {
    const external = await tx.externalTransaction.findFirst({ where: { id: data.externalTransactionId, businessId: actor.businessId, postedTransactionId: null, status: { notIn: ["DUPLICATE", "INVALID", "IGNORED"] } }, select: { id: true } });
    if (!external) return { ok: false as const, message: "That imported bank record is unavailable for owner-transfer review." };
    const status = data.classification === "UNRESOLVED" || data.classification === "OTHER" ? "PENDING_REVIEW" : "CLASSIFIED";
    const transfer = await tx.ownerMoneyTransfer.upsert({ where: { businessId_externalTransactionId: { businessId: actor.businessId, externalTransactionId: external.id } }, create: { businessId: actor.businessId, externalTransactionId: external.id, direction: data.direction, classification: data.classification, status, notes: data.notes, classifiedAt: status === "CLASSIFIED" ? new Date() : null, classifiedByUserId: status === "CLASSIFIED" ? actor.actorUserId : null }, update: { direction: data.direction, classification: data.classification, status, notes: data.notes, classifiedAt: status === "CLASSIFIED" ? new Date() : null, classifiedByUserId: status === "CLASSIFIED" ? actor.actorUserId : null, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "OwnerMoneyTransfer", entityId: transfer.id, afterJson: { direction: data.direction, classification: data.classification, status }, metadataJson: { executionMode: actor.executionMode, externalTransactionId: external.id } } });
    return { ok: true as const, transferId: transfer.id };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, message: "The transfer classification could not be saved safely. Refresh and try again." }; return { ok: false, message: "The transfer classification could not be saved safely. Refresh and try again." }; }
}
