import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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
  const removal = linked ? "ARCHIVED_LINKED_EVIDENCE" : "DELETED_UNLINKED";
  // This deployment uses a driver configuration that does not support
  // Prisma's interactive transactions. One parameterized PostgreSQL CTE
  // preserves the required all-or-nothing conditional tombstone plus audit.
  const changed = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH updated AS (
      UPDATE "Document"
      SET "deletedAt" = ${now}, "privateReadEligible" = false, "version" = "version" + 1
      WHERE "id" = ${document.id} AND "businessId" = ${actor.businessId} AND "deletedAt" IS NULL
      RETURNING "id"
    ), audit AS (
      INSERT INTO "AuditEvent" ("id", "actorType", "actorMembershipId", "businessId", "action", "entityType", "entityId", "metadataJson")
      SELECT ${crypto.randomUUID()}, 'USER', ${actor.actorUserId}, ${actor.businessId}, ${linked ? "UPDATE" : "DELETE"}, 'Document', "id", ${JSON.stringify({ documentRemoval: removal })}::jsonb
      FROM updated
    )
    SELECT "id" FROM updated
  `);
  if (changed.length !== 1) return { ok: false, code: "CONFLICT" };
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
