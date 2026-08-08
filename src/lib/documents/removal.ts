import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

import { getPrivateDocumentStorage } from "./r2-storage";

type Actor = { businessId: string; actorUserId: string };
type RemovalTraceStage = "AUTH_CONTEXT" | "DOCUMENT_LOADED" | "RELATIONSHIPS_CHECKED" | "MODE_SELECTED" | "DB_TOMBSTONE_STARTED" | "DB_TOMBSTONE_COMMITTED" | "R2_CLEANUP_ELIGIBILITY" | "R2_CLEANUP_COMPLETED" | "ACTION_RESPONSE";
type RemovalTraceOutcome = "PASS" | "FAIL";

export type DocumentRemovalResult =
  | { ok: true; mode: "DELETED" | "ARCHIVED"; cleanupPending: boolean }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT" | "STORAGE" };

function safeErrorCategory(error: unknown) {
  const candidate = error as { code?: unknown; name?: unknown; meta?: { code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } } } } | null;
  const prismaCode = typeof candidate?.code === "string" && /^[A-Z]\d{4}$/.test(candidate.code) ? candidate.code : undefined;
  const rawDatabaseCode = candidate?.meta?.code ?? candidate?.meta?.driverAdapterError?.cause?.originalCode;
  const databaseCode = typeof rawDatabaseCode === "string" && /^\d{5}$/.test(rawDatabaseCode) ? rawDatabaseCode : undefined;
  if (prismaCode && databaseCode) return `${prismaCode}_${databaseCode}`;
  if (prismaCode) return prismaCode;
  if (typeof candidate?.name === "string" && /^[A-Za-z]{1,48}$/.test(candidate.name)) return candidate.name;
  return "UNKNOWN";
}

export async function traceDocumentRemoval(businessId: string, correlationId: string, stage: RemovalTraceStage, outcome: RemovalTraceOutcome, category?: string) {
  try {
    await prisma.auditEvent.create({ data: { actorType: "SYSTEM", businessId, action: "UPDATE", entityType: "DocumentRemovalTrace", entityId: correlationId, metadataJson: { stage, outcome, ...(category && /^[A-Za-z0-9_]{1,64}$/.test(category) ? { category } : {}) } } });
  } catch { /* Internal diagnostics must never affect document state. */ }
}

/**
 * Removal is deliberately a tombstone, rather than a hard database delete:
 * this keeps immutable audit/retention history intact and makes any delayed
 * Queue message fail its `deletedAt: null` conditional lookup. Unlinked bytes
 * are removed from both private prefixes after the tombstone commits.
 */
export async function removePrivateDocument(actor: Actor, documentId: string, correlationId?: string): Promise<DocumentRemovalResult> {
  let document;
  try { document = await prisma.document.findFirst({
    where: { id: documentId, businessId: actor.businessId, deletedAt: null },
    select: {
      id: true, businessId: true, storageKey: true,
      transactions: { where: { unlinkedAt: null }, select: { id: true }, take: 1 },
      reimbursementExpenses: { select: { id: true }, take: 1 },
      payrollRuns: { select: { id: true }, take: 1 },
      taxPayments: { select: { id: true }, take: 1 },
    },
  }); } catch (error) {
    if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "DOCUMENT_LOADED", "FAIL", safeErrorCategory(error));
    throw error;
  }
  if (!document) return { ok: false, code: "NOT_FOUND" };
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "DOCUMENT_LOADED", "PASS");

  const linked = document.transactions.length > 0 || document.reimbursementExpenses.length > 0 || document.payrollRuns.length > 0 || document.taxPayments.length > 0;
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "RELATIONSHIPS_CHECKED", "PASS");
  const now = new Date();
  const removal = linked ? "ARCHIVED_LINKED_EVIDENCE" : "DELETED_UNLINKED";
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "MODE_SELECTED", "PASS", linked ? "ARCHIVE" : "DELETE");
  // This deployment uses a driver configuration that does not support
  // Prisma's interactive transactions. One parameterized PostgreSQL CTE
  // preserves the required all-or-nothing conditional tombstone plus audit.
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "DB_TOMBSTONE_STARTED", "PASS");
  let changed: { id: string }[];
  try { changed = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH updated AS (
      UPDATE "Document"
      SET "deletedAt" = ${now}, "status" = ${"DELETED"}, "privateReadEligible" = false, "version" = "version" + 1
      WHERE "id" = ${document.id} AND "businessId" = ${actor.businessId} AND "deletedAt" IS NULL
      RETURNING "id"
    ), audit AS (
      INSERT INTO "AuditEvent" ("id", "actorType", "actorMembershipId", "businessId", "action", "entityType", "entityId", "metadataJson")
      SELECT ${crypto.randomUUID()}, ${"USER"}, ${actor.actorUserId}, ${actor.businessId}, ${linked ? "UPDATE" : "DELETE"}, ${"Document"}, "id", ${JSON.stringify({ documentRemoval: removal })}::jsonb
      FROM updated
    )
    SELECT "id" FROM updated
  `); } catch (error) {
    if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "DB_TOMBSTONE_COMMITTED", "FAIL", safeErrorCategory(error));
    throw error;
  }
  if (changed.length !== 1) return { ok: false, code: "CONFLICT" };
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "DB_TOMBSTONE_COMMITTED", "PASS");
  if (linked || !document.storageKey) return { ok: true, mode: "ARCHIVED", cleanupPending: false };
  if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "R2_CLEANUP_ELIGIBILITY", "PASS");

  try {
    const storage = await getPrivateDocumentStorage();
    await Promise.all([storage.removeQuarantined(document.storageKey), storage.removeActive(document.storageKey)]);
    if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "R2_CLEANUP_COMPLETED", "PASS");
    return { ok: true, mode: "DELETED", cleanupPending: false };
  } catch {
    if (correlationId) await traceDocumentRemoval(actor.businessId, correlationId, "R2_CLEANUP_COMPLETED", "FAIL", "STORAGE");
    // The authorization tombstone is already durable, so content cannot be
    // served or resurrected. A later private cleanup can safely remove bytes.
    return { ok: true, mode: "DELETED", cleanupPending: true };
  }
}
