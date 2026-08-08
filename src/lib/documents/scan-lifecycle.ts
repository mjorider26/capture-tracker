import "server-only";

import { prisma } from "@/lib/prisma";

import { getPrivateDocumentStorage } from "./r2-storage";
import { appendDocumentScanTiming, type DocumentScanJob, type DocumentScanResult } from "./scan-contract";

export type { DocumentScanJob, DocumentScanResult } from "./scan-contract";

type ScanTarget = {
  id: string;
  businessId: string;
  version: number;
  storageKey: string;
  mimeType: string;
  uploadedByMembershipId: string;
};

const scanTargetWhere = (job: DocumentScanJob) => ({
  id: job.documentId,
  version: job.version,
  status: "QUARANTINED" as const,
  storageState: "QUARANTINED_PRIVATE" as const,
  malwareScanStatus: "PENDING" as const,
  deletedAt: null,
});

function scanTimingEvent(stage: "ACTIVE_COPY_COMPLETED" | "DATABASE_FINALIZATION_STARTED" | "DATABASE_FINALIZATION_COMMITTED" | "QUARANTINE_DELETE_COMPLETED", correlationId: string | undefined) {
  if (!correlationId) return;
  console.warn(JSON.stringify({ event: "document_scan_timing", stage, correlationId, at: new Date().toISOString() }));
}

async function persistApplicationScanTrace(target: ScanTarget, job: DocumentScanJob, result: DocumentScanResult) {
  if (!job.trace) return;
  try {
    await prisma.auditEvent.create({ data: {
      actorType: "SYSTEM", businessId: target.businessId, action: "UPDATE", entityType: "DocumentScanTrace", entityId: job.trace.correlationId,
      metadataJson: { result: result.category, timings: job.trace.timings },
    } });
  } catch {
    // This internal trace must never influence document state or Queue retry.
  }
}

export async function persistDocumentScanTrace(job: DocumentScanJob) {
  if (!job.trace) return;
  try {
    const document = await prisma.document.findFirst({
      where: { id: job.documentId },
      select: { businessId: true },
    });
    if (!document) return;
    const result = [...job.trace.timings].reverse().find((timing) => timing.result)?.result;
    await prisma.auditEvent.create({ data: {
      actorType: "SYSTEM", businessId: document.businessId, action: "UPDATE", entityType: "DocumentScanTrace", entityId: job.trace.correlationId,
      metadataJson: { ...(result ? { result } : {}), timings: job.trace.timings },
    } });
  } catch {
    // Internal timing must never change a document scan outcome.
  }
}

function safeScannerValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim().slice(0, 80);
  return normalized && /^[A-Za-z0-9._-]+$/.test(normalized) ? normalized : fallback;
}

async function targetFor(job: DocumentScanJob): Promise<ScanTarget | null> {
  return prisma.document.findFirst({
    where: scanTargetWhere(job),
    select: { id: true, businessId: true, version: true, storageKey: true, mimeType: true, uploadedByMembershipId: true },
  }) as Promise<ScanTarget | null>;
}

/**
 * Returns bytes only to the authenticated internal scanner boundary. It never
 * returns a storage key, business ID, or any client-visible document metadata.
 */
export async function readQuarantinedDocumentForScan(job: DocumentScanJob) {
  const target = await targetFor(job);
  if (!target?.storageKey) return null;
  const storage = await getPrivateDocumentStorage();
  // Only the internal scanner can use this recovery fallback. App reads still
  // require ACTIVE + CLEAN, so an orphaned active-prefix copy is never exposed.
  const object = await storage.getQuarantined(target.storageKey) ?? await storage.getActive(target.storageKey);
  if (!object) return null;
  return { bytes: new Uint8Array(await object.arrayBuffer()), mimeType: target.mimeType };
}

/**
 * Applies a scanner outcome with a conditional update. Queue delivery is
 * at-least-once, so only the first current result can change the document or
 * append an audit event. Old/replayed messages deliberately become no-ops.
 */
export async function applyDocumentScanResult(job: DocumentScanJob, result: DocumentScanResult) {
  const target = await targetFor(job);
  if (!target?.storageKey) return { state: "STALE" as const };

  const scannerId = safeScannerValue(result.scannerId, "clamav");
  const scannerVersion = safeScannerValue(result.scannerVersion, "unknown");
  const scannedAt = new Date();

  if (result.category === "CLEAN") {
    // Copying the original object between private prefixes preserves the bytes.
    // Reads stay denied until the conditional database update commits.
    appendDocumentScanTiming(job.trace, "ACTIVE_COPY_STARTED");
    await (await getPrivateDocumentStorage()).promoteQuarantined(target.storageKey);
    appendDocumentScanTiming(job.trace, "ACTIVE_COPY_COMPLETED");
    scanTimingEvent("ACTIVE_COPY_COMPLETED", job.trace?.correlationId);
    appendDocumentScanTiming(job.trace, "DATABASE_FINALIZATION_STARTED");
    scanTimingEvent("DATABASE_FINALIZATION_STARTED", job.trace?.correlationId);
    const activated = await prisma.$transaction(async (tx) => {
      const update = await tx.document.updateMany({
        where: scanTargetWhere(job),
        data: {
          status: "ACTIVE",
          storageState: "STORED_PRIVATE",
          privateReadEligible: true,
          malwareScanStatus: "CLEAN",
          malwareScanProvider: scannerId,
          malwareScannedAt: scannedAt,
          activatedAt: scannedAt,
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) return false;
      await tx.documentStatusHistory.create({ data: { businessId: target.businessId, documentId: target.id, previousStatus: "QUARANTINED", newStatus: "ACTIVE", actorUserId: target.uploadedByMembershipId, note: "Security scan passed; private document access was enabled." } });
      await tx.auditEvent.create({ data: { actorType: "SYSTEM", businessId: target.businessId, action: "VALIDATE", entityType: "Document", entityId: target.id, metadataJson: { securityScan: "passed", scanner: scannerId, scannerVersion } } });
      return true;
    });
    appendDocumentScanTiming(job.trace, "DATABASE_FINALIZATION_COMMITTED");
    scanTimingEvent("DATABASE_FINALIZATION_COMMITTED", job.trace?.correlationId);
    // Preserve the quarantine source until the authoritative database state
    // commits. Cleanup failure leaves a private duplicate, never a readable
    // unscanned document, and must not undo a completed clean activation.
    if (activated) {
      try {
        appendDocumentScanTiming(job.trace, "QUARANTINE_DELETE_STARTED");
        await (await getPrivateDocumentStorage()).finalizeQuarantinedPromotion(target.storageKey);
        appendDocumentScanTiming(job.trace, "QUARANTINE_DELETE_COMPLETED");
        scanTimingEvent("QUARANTINE_DELETE_COMPLETED", job.trace?.correlationId);
      } catch { /* safe private cleanup can retry later */ }
    }
    await persistApplicationScanTrace(target, job, result);
    return { state: activated ? "ACTIVATED" as const : "STALE" as const };
  }

  if (result.category === "INFECTED") {
    const rejected = await prisma.$transaction(async (tx) => {
      const update = await tx.document.updateMany({
        where: scanTargetWhere(job),
        data: { status: "REJECTED", privateReadEligible: false, malwareScanStatus: "INFECTED", malwareScanProvider: scannerId, malwareScannedAt: scannedAt, quarantineReasonCode: "SECURITY_SCAN_REJECTED", quarantineExplanation: "This file could not be accepted because it failed the security scan.", version: { increment: 1 } },
      });
      if (update.count !== 1) return false;
      await tx.documentStatusHistory.create({ data: { businessId: target.businessId, documentId: target.id, previousStatus: "QUARANTINED", newStatus: "REJECTED", reasonCode: "SECURITY_SCAN_REJECTED", actorUserId: target.uploadedByMembershipId, note: "Document rejected by the security scan." } });
      await tx.auditEvent.create({ data: { actorType: "SYSTEM", businessId: target.businessId, action: "REJECT", entityType: "Document", entityId: target.id, metadataJson: { securityScan: "rejected", scanner: scannerId, scannerVersion } } });
      return true;
    });
    await persistApplicationScanTrace(target, job, result);
    return { state: rejected ? "REJECTED" as const : "STALE" as const };
  }

  const failed = await prisma.$transaction(async (tx) => {
    const update = await tx.document.updateMany({
      where: scanTargetWhere(job),
      data: { malwareScanStatus: "FAILED", malwareScanProvider: scannerId, malwareScannedAt: scannedAt, quarantineReasonCode: "SECURITY_SCAN_UNAVAILABLE", quarantineExplanation: "We could not finish the security scan yet. The document remains private and unavailable until scanning succeeds.", version: { increment: 1 } },
    });
    if (update.count !== 1) return false;
    await tx.auditEvent.create({ data: { actorType: "SYSTEM", businessId: target.businessId, action: "QUARANTINE", entityType: "Document", entityId: target.id, metadataJson: { securityScan: "failed", scanner: scannerId, scannerVersion } } });
    return true;
  });
  await persistApplicationScanTrace(target, job, result);
  return { state: failed ? "FAILED" as const : "STALE" as const };
}
