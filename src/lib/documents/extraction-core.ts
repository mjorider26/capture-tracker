import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ExtractionField, ExtractionProvider } from "./extraction-provider";

export type ExtractionActor = { businessId: string; actorUserId: string };
type Client = Pick<PrismaClient, "$transaction" | "documentExtractionAttempt" | "documentExtractionCandidate">;
type Loader = (storageKey: string) => Promise<Uint8Array>;
const fieldTypes = ["MERCHANT_NAME", "DOCUMENT_DATE", "TOTAL_AMOUNT", "SUBTOTAL_AMOUNT", "SALES_TAX_AMOUNT", "TIP_AMOUNT", "REFERENCE_NUMBER", "CURRENCY", "PAYMENT_METHOD", "MASKED_ACCOUNT_REFERENCE", "DOCUMENT_DESCRIPTION"] as const;
const money = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const safeText = z.string().trim().min(1).max(500);

function normalize(field: ExtractionField) {
  const value = safeText.parse(field.originalValue).replace(/\s+/g, " ");
  let normalized = field.normalizedValue?.trim().replace(/\s+/g, " ") || null;
  if (["TOTAL_AMOUNT", "SUBTOTAL_AMOUNT", "SALES_TAX_AMOUNT", "TIP_AMOUNT"].includes(field.fieldType)) {
    if (!normalized || !money.test(normalized)) normalized = null;
    else { const [whole, fraction = ""] = normalized.split("."); normalized = `${whole}.${fraction.padEnd(2, "0")}`; }
  }
  if (field.fieldType === "DOCUMENT_DATE" && normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized = null;
  if (field.fieldType === "CURRENCY" && normalized && !/^[A-Z]{3}$/.test(normalized)) normalized = null;
  return { fieldType: field.fieldType, originalValue: value, normalizedValue: normalized, confidence: z.string().regex(/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/).parse(field.confidence), pageNumber: field.pageNumber && field.pageNumber > 0 ? field.pageNumber : null, sourceReference: field.sourceReference?.slice(0, 120) || null };
}

function eligible(document: { status: string; malwareScanStatus: string; storageState: string; privateReadEligible: boolean; storageKey: string | null; mimeType: string; deletedAt: Date | null }) {
  return document.status === "ACTIVE" && document.storageState === "STORED_PRIVATE" && document.privateReadEligible && !!document.storageKey && !document.deletedAt && ["application/pdf", "image/jpeg", "image/png"].includes(document.mimeType);
}

export async function runExtraction(client: Client, load: Loader, provider: ExtractionProvider, actor: ExtractionActor, documentId: string) {
  let requested: { id: string; storageKey: string; mimeType: string; displayName: string; sourceSha256: string; sourceObjectVersion: string | null } | { canonical: string } | "INELIGIBLE" | null = null;
  try {
    requested = await client.$transaction(async (tx) => {
      const document = await tx.document.findFirst({ where: { id: documentId, businessId: actor.businessId }, select: { id: true, status: true, malwareScanStatus: true, storageState: true, privateReadEligible: true, storageKey: true, mimeType: true, displayName: true, sha256: true, objectVersion: true, deletedAt: true } });
      if (!document) return null;
      if (!eligible(document)) return "INELIGIBLE" as const;
      const canonical = await tx.documentExtractionAttempt.findFirst({ where: { businessId: actor.businessId, documentId, sourceSha256: document.sha256, status: { in: ["PENDING", "PROCESSING", "COMPLETED"] } }, select: { id: true, status: true } });
      if (canonical) return { canonical: canonical.id } as const;
      const attempt = await tx.documentExtractionAttempt.create({ data: { businessId: actor.businessId, documentId, sourceSha256: document.sha256, sourceObjectVersion: document.objectVersion, adapterId: provider.id, adapterVersion: provider.version, status: "PROCESSING", requestedByUserId: actor.actorUserId, history: { create: { action: "REQUESTED", actorUserId: actor.actorUserId } } } });
      return { id: attempt.id, storageKey: document.storageKey!, mimeType: document.mimeType, displayName: document.displayName, sourceSha256: document.sha256, sourceObjectVersion: document.objectVersion };
    });
  } catch {
    const canonical = await client.documentExtractionAttempt.findFirst({ where: { businessId: actor.businessId, documentId, status: { in: ["PENDING", "PROCESSING", "COMPLETED"] } }, select: { id: true } });
    if (canonical) return { ok: true as const, state: "EXISTING" as const, attemptId: canonical.id };
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
  if (!requested) return { ok: false as const, code: "NOT_FOUND" as const };
  if (requested === "INELIGIBLE") return { ok: false as const, code: "INELIGIBLE" as const };
  if ("canonical" in requested) return { ok: true as const, state: "EXISTING" as const, attemptId: requested.canonical };
  try {
    const bytes = await load(requested.storageKey);
    const result = await provider.extract({ bytes, mimeType: requested.mimeType, displayName: requested.displayName, sourceSha256: requested.sourceSha256 });
    if (!result.ok) throw new Error(result.failureCode);
    const candidates = result.fields.filter((field) => fieldTypes.includes(field.fieldType)).map(normalize);
    await client.$transaction(async (tx) => {
      const current = await tx.document.findFirst({ where: { id: documentId, businessId: actor.businessId }, select: { sha256: true, objectVersion: true } });
      if (!current || current.sha256 !== requested.sourceSha256 || current.objectVersion !== requested.sourceObjectVersion) {
        await tx.documentExtractionAttempt.update({ where: { id: requested.id }, data: { status: "STALE", completedAt: new Date(), history: { create: { action: "STALE", actorUserId: actor.actorUserId } } } });
        return;
      }
      await tx.documentExtractionAttempt.update({ where: { id: requested.id }, data: { status: "COMPLETED", completedAt: new Date(), pageCount: result.pageCount, candidates: { create: candidates }, history: { create: { action: "COMPLETED", actorUserId: actor.actorUserId } } } });
    });
    const attempt = await client.documentExtractionAttempt.findFirst({ where: { id: requested.id, businessId: actor.businessId }, select: { status: true } });
    return attempt?.status === "STALE" ? { ok: false as const, code: "STALE" as const } : { ok: true as const, state: "COMPLETED" as const, attemptId: requested.id };
  } catch (error) {
    const code = error instanceof Error && error.message === "FIXTURE_FAILURE" ? "FIXTURE_FAILURE" : "EXTRACTION_UNAVAILABLE";
    await client.$transaction(async (tx) => { await tx.documentExtractionAttempt.update({ where: { id: requested!.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: code, history: { create: { action: "FAILED", actorUserId: actor.actorUserId } } } }); });
    return { ok: false as const, code: "FAILED" as const };
  }
}

export async function reviewExtractionCandidate(client: Client, actor: ExtractionActor, candidateId: string, review: "ACCEPTED" | "CORRECTED" | "REJECTED", correctedValue?: string) {
  try { return await client.$transaction(async (tx) => {
    const candidate = await tx.documentExtractionCandidate.findFirst({ where: { id: candidateId, businessId: actor.businessId }, include: { attempt: { select: { status: true, sourceSha256: true, sourceObjectVersion: true, document: { select: { sha256: true, objectVersion: true } } } } } });
    if (!candidate) return { ok: false as const, code: "NOT_FOUND" as const };
    if (candidate.attempt.status === "STALE" || candidate.attempt.sourceSha256 !== candidate.attempt.document.sha256 || candidate.attempt.sourceObjectVersion !== candidate.attempt.document.objectVersion) return { ok: false as const, code: "STALE" as const };
    if (candidate.reviewState !== "UNREVIEWED") return { ok: true as const, state: "ALREADY_REVIEWED" as const };
    const value = review === "CORRECTED" ? normalize({ fieldType: candidate.fieldType, originalValue: correctedValue ?? "", normalizedValue: correctedValue, confidence: candidate.confidence.toFixed(4) }).normalizedValue : null;
    if (review === "CORRECTED" && !value) return { ok: false as const, code: "INVALID" as const };
    const update = await tx.documentExtractionCandidate.updateMany({ where: { id: candidateId, businessId: actor.businessId, reviewState: "UNREVIEWED" }, data: { reviewState: review, correctedValue: value, reviewedByUserId: actor.actorUserId, reviewedAt: new Date() } });
    if (!update.count) return { ok: true as const, state: "ALREADY_REVIEWED" as const };
    await tx.documentExtractionHistory.create({ data: { businessId: actor.businessId, extractionAttemptId: candidate.extractionAttemptId, candidateId, action: review === "ACCEPTED" ? "ACCEPTED" : review === "CORRECTED" ? "CORRECTED" : "REJECTED", actorUserId: actor.actorUserId } });
    return { ok: true as const, state: review };
  }); } catch { return { ok: false as const, code: "INVALID" as const }; }
}
