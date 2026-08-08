import "server-only";

import { prisma } from "@/lib/prisma";
import { calculateDocumentRetentionUntil, canTransitionDocument, documentMetadataSchema, normalizeDocumentFilename, type DocumentStatusValue } from "./core";

type Actor = { businessId: string; actorUserId: string };
type Result<T> = { ok: true; value: T; duplicate?: boolean } | { ok: false; code: "INVALID" | "NOT_FOUND" | "INVALID_TRANSITION"; message: string };

export async function listDocuments(businessId: string) {
  return prisma.document.findMany({
    where: { businessId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      displayName: true,
      originalFilename: true,
      category: true,
      status: true,
      sizeBytes: true,
      retentionUntil: true,
      documentDate: true,
      malwareScanStatus: true,
      transactions: {
        where: { unlinkedAt: null },
        select: { id: true },
        take: 1,
      },
      extractionAttempts: {
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        select: {
          status: true,
          candidates: { select: { reviewState: true }, take: 10 },
        },
        take: 1,
      },
      matchRuns: {
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        select: {
          status: true,
          suggestions: {
            where: { status: "SUGGESTED" },
            select: { id: true },
            take: 1,
          },
        },
        take: 1,
      },
    },
  });
}
export async function getDocument(businessId: string, documentId: string) {
  return prisma.document.findFirst({ where: { businessId, id: documentId, deletedAt: null }, include: { statusHistory: { orderBy: { createdAt: "asc" } } } });
}
export async function createMetadataDocument(actor: Actor, input: unknown): Promise<Result<{ id: string }>> {
  const parsed = documentMetadataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "Document metadata is invalid." };
  let originalFilename: string;
  try { originalFilename = normalizeDocumentFilename(parsed.data.originalFilename); } catch { return { ok: false, code: "INVALID", message: "Document filename is invalid." }; }
  const hash = parsed.data.sha256.toLowerCase();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.document.findFirst({ where: { businessId: actor.businessId, sha256: hash }, select: { id: true } });
      if (existing) return { ok: true as const, value: existing, duplicate: true };
      const createdAt = new Date();
      const document = await tx.document.create({ data: {
        businessId: actor.businessId, uploadedByMembershipId: actor.actorUserId, originalFilename, displayName: parsed.data.displayName.trim(),
        mimeType: parsed.data.mimeType, sizeBytes: BigInt(parsed.data.sizeBytes), sha256: hash, type: parsed.data.category === "TAX_DOCUMENT" ? "TAX_FORM" : parsed.data.category === "PAYROLL_DOCUMENT" ? "PAYROLL_REPORT" : parsed.data.category,
        category: parsed.data.category, status: "PENDING_VALIDATION", storageState: "METADATA_ONLY", documentDate: parsed.data.documentDate,
        retentionClass: "GENERAL_TAX_SEVEN_YEARS", retentionUntil: calculateDocumentRetentionUntil(parsed.data.documentDate ?? createdAt), createdAt, updatedAt: createdAt,
      } });
      await tx.documentStatusHistory.create({ data: { businessId: actor.businessId, documentId: document.id, newStatus: "PENDING_VALIDATION", actorUserId: actor.actorUserId, note: "Synthetic metadata-only document created." } });
      return { ok: true as const, value: { id: document.id } };
    });
  } catch { return { ok: false, code: "INVALID", message: "Document metadata could not be created safely." }; }
}
export async function transitionDocument(actor: Actor, documentId: string, nextStatus: DocumentStatusValue, reasonCode?: string, note?: string): Promise<Result<{ id: string }>> {
  if (nextStatus === "QUARANTINED" && !reasonCode?.trim()) return { ok: false, code: "INVALID", message: "Quarantine requires a reason." };
  try { return await prisma.$transaction(async (tx) => {
    const document = await tx.document.findFirst({ where: { businessId: actor.businessId, id: documentId }, select: { id: true, status: true } });
    if (!document) return { ok: false as const, code: "NOT_FOUND" as const, message: "Document not found." };
    if (!canTransitionDocument(document.status as DocumentStatusValue, nextStatus)) return { ok: false as const, code: "INVALID_TRANSITION" as const, message: "This document status is terminal." };
    const updated = await tx.document.updateMany({ where: { businessId: actor.businessId, id: documentId, status: "PENDING_VALIDATION" }, data: { status: nextStatus, quarantineReasonCode: nextStatus === "QUARANTINED" ? reasonCode?.trim() : null, quarantineExplanation: nextStatus === "QUARANTINED" ? note?.trim() || null : null, activatedAt: nextStatus === "ACTIVE" ? new Date() : null } });
    if (updated.count !== 1) return { ok: false as const, code: "INVALID_TRANSITION" as const, message: "This document changed before its status could be updated." };
    await tx.documentStatusHistory.create({ data: { businessId: actor.businessId, documentId, previousStatus: "PENDING_VALIDATION", newStatus: nextStatus, reasonCode: nextStatus === "QUARANTINED" ? reasonCode?.trim() : null, note: note?.trim() || null, actorUserId: actor.actorUserId } });
    return { ok: true as const, value: { id: documentId } };
  }); } catch { return { ok: false, code: "INVALID", message: "Document status could not be updated safely." }; }
}

export async function seedDemoDocuments(actor: Actor) {
  const samples = [
    ["office-supplies-demo.pdf", "Office supply receipt", "application/pdf", "RECEIPT", "a".repeat(64), "ACTIVE"],
    ["monthly-statement-demo.pdf", "Monthly bank statement", "application/pdf", "BANK_STATEMENT", "b".repeat(64), "PENDING_VALIDATION"],
    ["quarterly-tax-demo.pdf", "Quarterly tax confirmation", "application/pdf", "TAX_DOCUMENT", "c".repeat(64), "ACTIVE"],
    ["payroll-summary-demo.pdf", "Payroll summary", "application/pdf", "PAYROLL_DOCUMENT", "d".repeat(64), "QUARANTINED"],
  ] as const;
  for (const [originalFilename, displayName, mimeType, category, sha256, target] of samples) {
    const created = await createMetadataDocument(actor, { originalFilename, displayName, mimeType, sizeBytes: 2048, category, sha256, documentDate: new Date("2026-07-01T12:00:00.000Z") });
    if (created.ok && !created.duplicate && target !== "PENDING_VALIDATION") await transitionDocument(actor, created.value.id, target, target === "QUARANTINED" ? "SYNTHETIC_REVIEW" : undefined, target === "QUARANTINED" ? "Synthetic demo metadata was quarantined during validation." : undefined);
  }
}
