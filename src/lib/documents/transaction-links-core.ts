import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type TransactionDocumentActor = { businessId: string; actorUserId: string };
export type TransactionDocumentLinkOutcome =
  | { ok: true; state: "LINKED" | "ALREADY_LINKED" | "UNLINKED" | "ALREADY_UNLINKED"; linkId: string }
  | { ok: false; code: "NOT_FOUND" | "DOCUMENT_NOT_ELIGIBLE" | "INVALID" };

type Client = Pick<PrismaClient, "$transaction" | "transactionDocument">;
type LinkClient = Prisma.TransactionClient;

export async function linkDocumentToTransactionInTransaction(client: LinkClient, actor: TransactionDocumentActor, transactionId: string, documentId: string, note?: string): Promise<TransactionDocumentLinkOutcome> {
  const [transaction, document] = await Promise.all([
        client.transaction.findFirst({ where: { id: transactionId, businessId: actor.businessId, voidedAt: null }, select: { id: true } }),
        client.document.findFirst({ where: { id: documentId, businessId: actor.businessId }, select: { id: true, status: true, malwareScanStatus: true, storageState: true, privateReadEligible: true, deletedAt: true } }),
  ]);
  if (!transaction || !document) return { ok: false as const, code: "NOT_FOUND" as const };
  if (document.status !== "ACTIVE" || document.malwareScanStatus !== "CLEAN" || document.storageState !== "STORED_PRIVATE" || !document.privateReadEligible || document.deletedAt) return { ok: false as const, code: "DOCUMENT_NOT_ELIGIBLE" as const };
  const existing = await client.transactionDocument.findFirst({ where: { businessId: actor.businessId, transactionId, documentId, unlinkedAt: null }, select: { id: true } });
  if (existing) return { ok: true as const, state: "ALREADY_LINKED" as const, linkId: existing.id };
  const link = await client.transactionDocument.create({ data: { businessId: actor.businessId, transactionId, documentId, linkedByUserId: actor.actorUserId, history: { create: { action: "LINKED", actorUserId: actor.actorUserId, note: note?.slice(0, 200) || null } } } });
  return { ok: true as const, state: "LINKED" as const, linkId: link.id };
}

export async function linkDocumentToTransactionCore(client: Client, actor: TransactionDocumentActor, transactionId: string, documentId: string): Promise<TransactionDocumentLinkOutcome> {
  // A concurrent unique conflict can arrive before the winning transaction is
  // visible to this client. Retry the canonical read/transaction briefly so
  // duplicate clicks remain idempotent instead of surfacing a false failure.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(async (tx) => linkDocumentToTransactionInTransaction(tx, actor, transactionId, documentId));
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code !== "P2002" && code !== "P2034") return { ok: false, code: "INVALID" };
      const canonical = await client.transactionDocument.findFirst({ where: { businessId: actor.businessId, transactionId, documentId, unlinkedAt: null }, select: { id: true } });
      if (canonical) return { ok: true, state: "ALREADY_LINKED", linkId: canonical.id };
      if (attempt < 2) await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
  }
  return { ok: false, code: "INVALID" };
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
