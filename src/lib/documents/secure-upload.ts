import "server-only";

import { prisma } from "@/lib/prisma";

import {
  calculateDocumentRetentionUntil,
  DOCUMENT_MAX_METADATA_BYTES,
  normalizeDocumentFilename,
} from "./core";
import { getPrivateDocumentStorage } from "./r2-storage";

type Actor = { businessId: string; actorUserId: string };
type ApprovedMimeType = "application/pdf" | "image/jpeg" | "image/png";

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const extensions: Record<ApprovedMimeType, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

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
    await storage.removeActive(key);
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

    const sha256 = await hashBytes(bytes);
    const existing = await prisma.document.findFirst({
      where: { businessId: actor.businessId, sha256 },
      select: { id: true },
    });
    if (existing) return { ok: true as const, documentId: existing.id, duplicate: true, outcome: "EXISTING" as const };

    const key = crypto.randomUUID().replaceAll("-", "");
    const storage = await getPrivateDocumentStorage();
    await storage.putActive(key, bytes, { sha256, version: "1" }, mimeType);
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
            status: "ACTIVE",
            storageState: "STORED_PRIVATE",
            storageProvider: "CLOUDFLARE_R2",
            storageKey: key,
            retentionClass: "GENERAL_TAX_SEVEN_YEARS",
            retentionUntil: calculateDocumentRetentionUntil(now),
            uploadCompletedAt: now,
            activatedAt: now,
            privateReadEligible: true,
            // No malware scan has run. Strict synchronous validation is the
            // private-pilot control until untrusted uploads are introduced.
            malwareScanStatus: "NOT_STARTED",
            statusHistory: {
              create: {
                newStatus: "ACTIVE",
                actorUserId: actor.actorUserId,
                note: "Private R2 upload passed synchronous type and size validation; malware scanning is deferred for the private pilot.",
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
            metadataJson: { storage: "private-r2", validation: "synchronous", malwareScanning: "deferred-private-pilot" },
          },
        });
        return created;
      });
      return { ok: true as const, documentId: document.id, duplicate: false, outcome: "ACTIVE" as const };
    } catch (error) {
      await cleanupOrphan(key, sha256.slice(0, 12));
      if (isUniqueDocumentHashError(error)) {
        const canonical = await prisma.document.findFirst({ where: { businessId: actor.businessId, sha256 }, select: { id: true } });
        if (canonical) return { ok: true as const, documentId: canonical.id, duplicate: true, outcome: "EXISTING" as const };
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
