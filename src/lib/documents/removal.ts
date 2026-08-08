import "server-only";

import { prisma } from "@/lib/prisma";

import { getPrivateDocumentStorage } from "./r2-storage";

type Actor = { businessId: string; actorUserId: string };

export type DocumentRemovalResult =
  | { ok: true; mode: "DELETED" | "ARCHIVED"; cleanupPending: boolean }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT" | "STORAGE" };

/**
 * Removal is deliberately a tombstone, rather than a hard database delete:
 * this keeps immutable audit/retention history intact and makes any delayed
 * Queue message fail its `deletedAt: null` conditional lookup. Unlinked bytes
 * are removed from both private prefixes after the tombstone commits.
 */
export async function removePrivateDocument(actor: Actor, documentId: string): Promise<DocumentRemovalResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, businessId: actor.businessId, deletedAt: null },
    select: {
      id: true, businessId: true, storageKey: true,
      transactions: { where: { unlinkedAt: null }, select: { id: true }, take: 1 },
      reimbursementExpenses: { select: { id: true }, take: 1 },
      payrollRuns: { select: { id: true }, take: 1 },
      taxPayments: { select: { id: true }, take: 1 },
    },
  });
  if (!document) return { ok: false, code: "NOT_FOUND" };

  const linked = document.transactions.length > 0 || document.reimbursementExpenses.length > 0 || document.payrollRuns.length > 0 || document.taxPayments.length > 0;
  const now = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const update = await tx.document.updateMany({
      where: { id: document.id, businessId: actor.businessId, deletedAt: null },
      data: { deletedAt: now, privateReadEligible: false, version: { increment: 1 } },
    });
    if (update.count !== 1) return false;
    await tx.auditEvent.create({ data: {
      actorType: "USER", actorMembershipId: actor.actorUserId, businessId: actor.businessId, action: linked ? "UPDATE" : "DELETE", entityType: "Document", entityId: document.id,
      metadataJson: { documentRemoval: linked ? "ARCHIVED_LINKED_EVIDENCE" : "DELETED_UNLINKED" },
    } });
    return true;
  });
  if (!changed) return { ok: false, code: "CONFLICT" };
  if (linked || !document.storageKey) return { ok: true, mode: "ARCHIVED", cleanupPending: false };

  try {
    const storage = await getPrivateDocumentStorage();
    await Promise.all([storage.removeQuarantined(document.storageKey), storage.removeActive(document.storageKey)]);
    return { ok: true, mode: "DELETED", cleanupPending: false };
  } catch {
    // The authorization tombstone is already durable, so content cannot be
    // served or resurrected. A later private cleanup can safely remove bytes.
    return { ok: true, mode: "DELETED", cleanupPending: true };
  }
}
