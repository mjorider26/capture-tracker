import "server-only";

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

import {
  calculateDocumentRetentionUntil,
  DOCUMENT_MAX_METADATA_BYTES,
  normalizeDocumentFilename,
} from "./core";

type Actor = { businessId: string; actorUserId: string };
type ScannerResult = "CLEAN" | "INFECTED" | "FAILED";

const localStorageRoot = join(process.cwd(), ".document-storage");
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function detectMimeType(bytes: Uint8Array) {
  if (new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (pngSignature.every((value, index) => bytes[index] === value)) return "image/png";
  return null;
}

async function hashBytes(bytes: Uint8Array) {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", input))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function assertLocalFictionalStorage() {
  if (process.env.NODE_ENV === "production" || process.env.CAPTURE_TRACKER_REAL_DATA_APPROVED === "true") {
    throw new Error("Secure upload storage is not approved for production.");
  }
}

async function put(namespace: "pending", key: string, bytes: Uint8Array) {
  assertLocalFictionalStorage();
  await mkdir(join(localStorageRoot, namespace), { recursive: true });
  await writeFile(join(localStorageRoot, namespace, key), bytes, { flag: "wx" });
}

async function promote(key: string, namespace: "active" | "quarantine") {
  await mkdir(join(localStorageRoot, namespace), { recursive: true });
  await rename(join(localStorageRoot, "pending", key), join(localStorageRoot, namespace, key));
}

async function remove(namespace: "pending" | "active" | "quarantine", key: string) {
  await rm(join(localStorageRoot, namespace, key), { force: true });
}

function scanFictionalBytes(bytes: Uint8Array): ScannerResult {
  const sample = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 128)));
  if (sample.includes("SCANNER_ERROR")) return "FAILED";
  return sample.includes("SUSPICIOUS") ? "INFECTED" : "CLEAN";
}

export async function readLocalActive(key: string) {
  assertLocalFictionalStorage();
  return readFile(join(localStorageRoot, "active", key));
}

export async function uploadFictionalDocument(actor: Actor, file: File) {
  try {
    assertLocalFictionalStorage();
    const name = normalizeDocumentFilename(file.name);
    if (!file.size || file.size > DOCUMENT_MAX_METADATA_BYTES) {
      return { ok: false as const, code: "INVALID", message: "File must be between 1 byte and 10 MiB." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      return { ok: false as const, code: "INVALID", message: "File size changed during upload." };
    }

    const mimeType = detectMimeType(bytes);
    if (!mimeType || mimeType !== file.type) {
      return { ok: false as const, code: "INVALID", message: "File content is not an approved PDF, JPEG, or PNG." };
    }

    const sha256 = await hashBytes(bytes);
    const existing = await prisma.document.findFirst({
      where: { businessId: actor.businessId, sha256 },
      select: { id: true },
    });
    if (existing) return { ok: true as const, documentId: existing.id, duplicate: true, outcome: "EXISTING" as const };

    const key = crypto.randomUUID().replaceAll("-", "");
    await put("pending", key, bytes);
    const scanResult = scanFictionalBytes(bytes);
    const now = new Date();

    if (scanResult === "FAILED") {
      try {
        const document = await prisma.document.create({
          data: {
            businessId: actor.businessId,
            uploadedByMembershipId: actor.actorUserId,
            originalFilename: name,
            displayName: name,
            mimeType,
            sizeBytes: BigInt(bytes.length),
            storedSizeBytes: BigInt(bytes.length),
            sha256,
            type: "OTHER",
            category: "OTHER",
            status: "PENDING_VALIDATION",
            storageState: "PENDING_STORAGE",
            storageProvider: "LOCAL_FICTIONAL",
            storageKey: key,
            malwareScanStatus: "FAILED",
            malwareScannedAt: now,
            retentionClass: "GENERAL_TAX_SEVEN_YEARS",
            retentionUntil: calculateDocumentRetentionUntil(now),
            privateReadEligible: false,
            validationError: "Fictional scanner was unavailable; the document remains inaccessible.",
            statusHistory: { create: { newStatus: "PENDING_VALIDATION", actorUserId: actor.actorUserId, note: "Fictional scanner was unavailable; private object remains pending." } },
          },
        });
        return { ok: true as const, documentId: document.id, duplicate: false, outcome: "SCANNER_ERROR" as const };
      } catch (error) {
        await remove("pending", key);
        if (isUniqueDocumentHashError(error)) {
          const canonical = await prisma.document.findFirst({ where: { businessId: actor.businessId, sha256 }, select: { id: true } });
          if (canonical) return { ok: true as const, documentId: canonical.id, duplicate: true, outcome: "EXISTING" as const };
        }
        return { ok: false as const, code: "STORAGE", message: "Document could not be stored safely." };
      }
    }

    const destination = scanResult === "INFECTED" ? "quarantine" : "active";
    try {
      // Promotion precedes the visible database state. A database failure is compensated below.
      await promote(key, destination);
      const result = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            businessId: actor.businessId,
            uploadedByMembershipId: actor.actorUserId,
            originalFilename: name,
            displayName: name,
            mimeType,
            sizeBytes: BigInt(bytes.length),
            storedSizeBytes: BigInt(bytes.length),
            sha256,
            type: "OTHER",
            category: "OTHER",
            status: scanResult === "INFECTED" ? "QUARANTINED" : "ACTIVE",
            storageState: scanResult === "INFECTED" ? "QUARANTINED_PRIVATE" : "STORED_PRIVATE",
            storageProvider: "LOCAL_FICTIONAL",
            storageKey: key,
            malwareScanStatus: scanResult,
            malwareScannedAt: now,
            retentionClass: "GENERAL_TAX_SEVEN_YEARS",
            retentionUntil: calculateDocumentRetentionUntil(now),
            uploadCompletedAt: now,
            privateReadEligible: scanResult === "CLEAN",
            quarantineReasonCode: scanResult === "INFECTED" ? "SYNTHETIC_SCANNER_RESULT" : null,
            quarantineExplanation: scanResult === "INFECTED" ? "Fictional development scanner result." : null,
            statusHistory: {
              create: [
                { newStatus: "PENDING_VALIDATION", actorUserId: actor.actorUserId, note: "Fictional binary upload received." },
                { previousStatus: "PENDING_VALIDATION", newStatus: scanResult === "INFECTED" ? "QUARANTINED" : "ACTIVE", reasonCode: scanResult === "INFECTED" ? "SYNTHETIC_SCANNER_RESULT" : null, actorUserId: actor.actorUserId, note: "Fictional development scanner completed." },
              ],
            },
          },
        });
        return document;
      });
      return { ok: true as const, documentId: result.id, duplicate: false, outcome: scanResult === "INFECTED" ? "QUARANTINED" as const : "ACTIVE" as const };
    } catch (error) {
      await remove(destination, key);
      if (isUniqueDocumentHashError(error)) {
        const canonical = await prisma.document.findFirst({ where: { businessId: actor.businessId, sha256 }, select: { id: true } });
        if (canonical) return { ok: true as const, documentId: canonical.id, duplicate: true, outcome: "EXISTING" as const };
      }
      return { ok: false as const, code: "STORAGE", message: "Document could not be stored safely." };
    }
  } catch {
    return { ok: false as const, code: "UNAVAILABLE", message: "Fictional secure upload is unavailable." };
  }
}

function isUniqueDocumentHashError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
