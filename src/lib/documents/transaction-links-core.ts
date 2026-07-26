import type { PrismaClient } from "@/generated/prisma/client";

export type TransactionDocumentActor = { businessId: string; actorUserId: string };
export type TransactionDocumentLinkOutcome =
  | { ok: true; state: "LINKED" | "ALREADY_LINKED" | "UNLINKED" | "ALREADY_UNLINKED"; linkId: string }
  | { ok: false; code: "NOT_FOUND" | "DOCUMENT_NOT_ELIGIBLE" | "INVALID" };

type Client = Pick<PrismaClient, "$transaction" | "transactionDocument">;

export async function linkDocumentToTransactionCore(client: Client, actor: TransactionDocumentActor, transactionId: string, documentId: string): Promise<TransactionDocumentLinkOutcome> {
  try {
    return await client.$transaction(async (tx) => {
      const [transaction, document] = await Promise.all([
        tx.transaction.findFirst({ where: { id: transactionId, businessId: actor.businessId, voidedAt: null }, select: { id: true } }),
        tx.document.findFirst({ where: { id: documentId, businessId: actor.businessId }, select: { id: true, status: true, malwareScanStatus: true, storageState: true, privateReadEligible: true, deletedAt: true } }),
      ]);
      if (!transaction || !document) return { ok: false as const, code: "NOT_FOUND" as const };
      if (document.status !== "ACTIVE" || document.malwareScanStatus !== "CLEAN" || document.storageState !== "STORED_PRIVATE" || !document.privateReadEligible || document.deletedAt) return { ok: false as const, code: "DOCUMENT_NOT_ELIGIBLE" as const };
      const existing = await tx.transactionDocument.findFirst({ where: { businessId: actor.businessId, transactionId, documentId, unlinkedAt: null }, select: { id: true } });
      if (existing) return { ok: true as const, state: "ALREADY_LINKED" as const, linkId: existing.id };
      const link = await tx.transactionDocument.create({ data: { businessId: actor.businessId, transactionId, documentId, linkedByUserId: actor.actorUserId, history: { create: { action: "LINKED", actorUserId: actor.actorUserId } } } });
      return { ok: true as const, state: "LINKED" as const, linkId: link.id };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const canonical = await client.transactionDocument.findFirst({ where: { businessId: actor.businessId, transactionId, documentId, unlinkedAt: null }, select: { id: true } });
      if (canonical) return { ok: true, state: "ALREADY_LINKED", linkId: canonical.id };
    }
    return { ok: false, code: "INVALID" };
  }
}

export async function unlinkDocumentFromTransactionCore(client: Client, actor: TransactionDocumentActor, linkId: string, reason?: string): Promise<TransactionDocumentLinkOutcome> {
  try { return await client.$transaction(async (tx) => {
    const link = await tx.transactionDocument.findFirst({ where: { id: linkId, businessId: actor.businessId }, select: { id: true, unlinkedAt: true } });
    if (!link) return { ok: false as const, code: "NOT_FOUND" as const };
    if (link.unlinkedAt) return { ok: true as const, state: "ALREADY_UNLINKED" as const, linkId };
    const updated = await tx.transactionDocument.updateMany({ where: { id: linkId, businessId: actor.businessId, unlinkedAt: null }, data: { unlinkedAt: new Date(), unlinkedByUserId: actor.actorUserId, unlinkReason: reason?.trim() || null } });
    if (!updated.count) return { ok: true as const, state: "ALREADY_UNLINKED" as const, linkId };
    await tx.transactionDocumentHistory.create({ data: { businessId: actor.businessId, transactionDocumentId: linkId, action: "UNLINKED", actorUserId: actor.actorUserId, note: reason?.trim() || null } });
    return { ok: true as const, state: "UNLINKED" as const, linkId };
  }); } catch { return { ok: false, code: "INVALID" }; }
}
