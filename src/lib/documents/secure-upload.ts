import "server-only";

import { prisma } from "@/lib/prisma";

import {
  calculateDocumentRetentionUntil,
  DOCUMENT_MAX_METADATA_BYTES,
  normalizeDocumentFilename,
} from "./core";
import { getPrivateDocumentStorage } from "./r2-storage";
import { enqueueDocumentScan } from "./scan-queue";
import { appendDocumentScanTiming, type DocumentScanTrace } from "./scan-contract";

type Actor = { businessId: string; actorUserId: string };
type ApprovedMimeType = "application/pdf" | "image/jpeg" | "image/png";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const extensions: Record<ApprovedMimeType, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

function scanTimingEvent(stage: "UPLOAD_ACCEPTED" | "DOCUMENT_QUARANTINED" | "QUEUE_PRODUCED", correlationId: string, at: string) {
  console.warn(JSON.stringify({ event: "document_scan_timing", stage, correlationId, at }));
}

function detectMimeType(bytes: Uint8Array): ApprovedMimeType | null {
  const text = new TextDecoder().decode(bytes.slice(0, 5));
  if (text === "%PDF-" && new TextDecoder().decode(bytes.slice(Math.max(0, bytes.length - 1024))).includes("%%EOF")) return "application/pdf";
  if (bytes.length >= 24 && pngSignature.every((value, index) => bytes[index] === value) && new TextDecoder().decode(bytes.slice(12, 16)) === "IHDR") return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return "image/jpeg";
  return null;
}

function extensionMatches(name: string, mimeType: ApprovedMimeType) {
  const lower = name.toLowerCase();
  return lower.endsWith(extensions[mimeType]) || (mimeType === "image/jpeg" && lower.endsWith(".jpeg"));
}

async function hashBytes(bytes: Uint8Array) {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function cleanupOrphan(key: string, fingerprint: string) {
  try {
    const storage = await getPrivateDocumentStorage();
    await storage.removeQuarantined(key);
  } catch {
    // The fingerprint is intentionally non-reversible and is only for controlled recovery.
    console.error("Document object cleanup failed", { fingerprint });
  }
}

export async function uploadPrivateDocument(actor: Actor, file: File) {
  try {
    const name = normalizeDocumentFilename(file.name);
    if (!file.size || file.size > DOCUMENT_MAX_METADATA_BYTES) {
      return { ok: false as const, code: "INVALID", message: "File must be between 1 byte and 10 MiB." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) return { ok: false as const, code: "INVALID", message: "File size changed during upload." };

    const mimeType = detectMimeType(bytes);
    if (!mimeType || file.type !== mimeType || !extensionMatches(name, mimeType)) {
      return { ok: false as const, code: "INVALID", message: "File name, declared type, and validated file content must be the same approved type." };
    }

    const trace: DocumentScanTrace = { correlationId: crypto.randomUUID().replaceAll("-", ""), timings: [] };
    appendDocumentScanTiming(trace, "UPLOAD_COMPLETED");

    const sha256 = await hashBytes(bytes);
    const existing = await prisma.document.findFirst({
      where: { businessId: actor.businessId, sha256 },
      select: { id: true, status: true, malwareScanStatus: true },
    });
    if (existing?.status === "REJECTED" || existing?.malwareScanStatus === "INFECTED") {
      return { ok: false as const, code: "REJECTED" as const, message: "This file was previously rejected by the security scan and cannot be uploaded again." };
    }
    if (existing) return { ok: true as const, documentId: existing.id, duplicate: true, outcome: existing.status === "QUARANTINED" ? "QUARANTINED" as const : "EXISTING" as const };

    // Tenant-scoped object keys keep R2 cleanup and recovery bounded even
    // though object storage itself has no relational authorization model.
    const key = `${actor.businessId}/${crypto.randomUUID().replaceAll("-", "")}`;
    const storage = await getPrivateDocumentStorage();
    await storage.putQuarantined(key, bytes, { sha256, version: "1" }, mimeType);
    const now = new Date();
    try {
      const document = await prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            businessId: actor.businessId,
            uploadedByMembershipId: actor.actorUserId,
            originalFilename: name,
            displayName: name,
            mimeType,
            detectedMimeType: mimeType,
            sizeBytes: BigInt(bytes.length),
            storedSizeBytes: BigInt(bytes.length),
            sha256,
            type: "OTHER",
            category: "OTHER",
            status: "QUARANTINED",
            storageState: "QUARANTINED_PRIVATE",
            storageProvider: "CLOUDFLARE_R2",
            storageKey: key,
            retentionClass: "GENERAL_TAX_SEVEN_YEARS",
            retentionUntil: calculateDocumentRetentionUntil(now),
            uploadCompletedAt: now,
            privateReadEligible: false,
            malwareScanStatus: "PENDING",
            statusHistory: {
              create: {
                newStatus: "QUARANTINED",
                actorUserId: actor.actorUserId,
                note: "Private R2 upload passed structural validation and is awaiting a security scan.",
              },
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorType: "USER",
            businessId: actor.businessId,
            actorMembershipId: actor.actorUserId,
            action: "CREATE",
            entityType: "Document",
            entityId: created.id,
            afterJson: { mimeType, sizeBytes: String(bytes.length), sha256 },
            metadataJson: { storage: "private-r2-quarantine", validation: "synchronous", malwareScanning: "queued" },
          },
        });
        return created;
      });
      appendDocumentScanTiming(trace, "DOCUMENT_QUARANTINED");
      let scanQueueUnavailable = false;
      try {
        appendDocumentScanTiming(trace, "QUEUE_PRODUCED");
        await enqueueDocumentScan({ documentId: document.id, version: document.version, trace });
        scanTimingEvent("QUEUE_PRODUCED", trace.correlationId, new Date().toISOString());
      }
      catch {
        scanQueueUnavailable = true;
        await prisma.$transaction(async (tx) => {
          const failed = await tx.document.updateMany({ where: { id: document.id, businessId: actor.businessId, version: document.version, status: "QUARANTINED", malwareScanStatus: "PENDING" }, data: { malwareScanStatus: "FAILED", malwareScanProvider: "queue-unavailable" } });
          if (failed.count === 1) await tx.auditEvent.create({ data: { actorType: "SYSTEM", businessId: actor.businessId, action: "QUARANTINE", entityType: "Document", entityId: document.id, metadataJson: { securityScan: "queue-unavailable" } } });
        });
      }
      return { ok: true as const, documentId: document.id, duplicate: false, outcome: scanQueueUnavailable ? "SCAN_FAILED" as const : "QUARANTINED" as const };
    } catch (error) {
      try { await storage.removeQuarantined(key); } catch { await cleanupOrphan(key, sha256.slice(0, 12)); }
      if (isUniqueDocumentHashError(error)) {
        const canonical = await prisma.document.findFirst({ where: { businessId: actor.businessId, sha256 }, select: { id: true, status: true, malwareScanStatus: true } });
        if (canonical?.status === "REJECTED" || canonical?.malwareScanStatus === "INFECTED") return { ok: false as const, code: "REJECTED" as const, message: "This file was previously rejected by the security scan and cannot be uploaded again." };
        if (canonical) return { ok: true as const, documentId: canonical.id, duplicate: true, outcome: canonical.status === "QUARANTINED" ? "QUARANTINED" as const : "EXISTING" as const };
      }
      return { ok: false as const, code: "STORAGE", message: "Document could not be stored safely." };
    }
  } catch {
    return { ok: false as const, code: "UNAVAILABLE", message: "Private document storage is unavailable. Please try again." };
  }
}

function isUniqueDocumentHashError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
