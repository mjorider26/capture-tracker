import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { linkDocumentToTransactionInTransaction } from "./transaction-links-core";
import { createLocalTransactionMatchingProvider, fingerprintReviewedEvidence, type ReviewedEvidence } from "./transaction-matching-provider";

export type TransactionMatchingActor = { businessId: string; actorUserId: string };
type Client = Pick<PrismaClient, "$transaction" | "documentMatchRun">;
type Tx = Prisma.TransactionClient;
const useful = new Set(["TOTAL_AMOUNT", "DOCUMENT_DATE", "MERCHANT_NAME", "CURRENCY", "DOCUMENT_DESCRIPTION", "REFERENCE_NUMBER", "PAYMENT_METHOD", "MASKED_ACCOUNT_REFERENCE"]);

function currentDate(value: string | null | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined; }
function evidenceFrom(candidates: Array<{ id: string; fieldType: string; originalValue: string; normalizedValue: string | null; correctedValue: string | null; reviewState: string }>) {
  const values = candidates.filter((candidate) => (candidate.reviewState === "ACCEPTED" || candidate.reviewState === "CORRECTED") && useful.has(candidate.fieldType)).map((candidate) => ({ id: candidate.id, fieldType: candidate.fieldType, value: candidate.reviewState === "CORRECTED" ? candidate.correctedValue! : candidate.normalizedValue ?? candidate.originalValue }));
  const first = (fieldType: string) => values.find((value) => value.fieldType === fieldType)?.value;
  const evidence: ReviewedEvidence = { amount: first("TOTAL_AMOUNT"), date: currentDate(first("DOCUMENT_DATE")), merchant: first("MERCHANT_NAME"), currency: first("CURRENCY"), description: first("DOCUMENT_DESCRIPTION"), identifier: first("REFERENCE_NUMBER"), paymentMethod: first("PAYMENT_METHOD"), maskedAccountReference: first("MASKED_ACCOUNT_REFERENCE") };
  return { values, evidence };
}
function eligible(document: { status: string; malwareScanStatus: string; storageState: string; privateReadEligible: boolean; deletedAt: Date | null }) { return document.status === "ACTIVE" && document.malwareScanStatus === "CLEAN" && document.storageState === "STORED_PRIVATE" && document.privateReadEligible && !document.deletedAt; }
function range(date: string | Date) { const iso = typeof date === "string" ? date : date.toISOString().slice(0, 10); const center = new Date(`${iso}T00:00:00.000Z`); const before = new Date(center); before.setUTCDate(before.getUTCDate() - 31); const after = new Date(center); after.setUTCDate(after.getUTCDate() + 31); return { gte: before, lte: after }; }

async function reviewedEvidence(tx: Tx, businessId: string, documentId: string) {
  const [business, document] = await Promise.all([tx.business.findUnique({ where: { id: businessId }, select: { currency: true } }), tx.document.findFirst({ where: { id: documentId, businessId }, select: { id: true, status: true, malwareScanStatus: true, storageState: true, privateReadEligible: true, deletedAt: true, sha256: true, objectVersion: true, documentDate: true } })]);
  if (!business || !document || !eligible(document)) return null;
  const attempt = await tx.documentExtractionAttempt.findFirst({ where: { businessId, documentId, status: "COMPLETED", sourceSha256: document.sha256, sourceObjectVersion: document.objectVersion }, include: { candidates: { orderBy: { id: "asc" } } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }] });
  if (!attempt) return null;
  const { values, evidence } = evidenceFrom(attempt.candidates);
  if (!values.length) return null;
  return { document, attempt, values, evidence, currency: business.currency, fingerprint: fingerprintReviewedEvidence(attempt.id, document.sha256, document.objectVersion, values) };
}

async function staleSuggestion(tx: Tx, actor: TransactionMatchingActor, suggestionId: string, runId: string, action: "STALE" | "LINK_FAILED" = "STALE") {
  const changed = await tx.documentMatchSuggestion.updateMany({ where: { id: suggestionId, businessId: actor.businessId, status: "SUGGESTED" }, data: { status: "STALE", decidedAt: new Date() } });
  if (changed.count) await tx.documentMatchHistory.create({ data: { businessId: actor.businessId, runId, suggestionId, action, actorUserId: actor.actorUserId } });
}

export async function generateTransactionMatches(client: Client, actor: TransactionMatchingActor, documentId: string) {
  const provider = createLocalTransactionMatchingProvider();
  try {
    return await client.$transaction(async (tx) => {
      const current = await reviewedEvidence(tx, actor.businessId, documentId);
      if (!current) return { ok: false as const, code: "INELIGIBLE" as const };
      const canonical = await tx.documentMatchRun.findFirst({ where: { businessId: actor.businessId, documentId, evidenceFingerprint: current.fingerprint, status: { in: ["PROCESSING", "COMPLETED"] } }, select: { id: true, status: true } });
      if (canonical) return { ok: true as const, state: "EXISTING" as const, runId: canonical.id };
      const run = await tx.documentMatchRun.create({ data: { businessId: actor.businessId, documentId, extractionAttemptId: current.attempt.id, sourceSha256: current.document.sha256, sourceObjectVersion: current.document.objectVersion, evidenceFingerprint: current.fingerprint, matchingEngineId: provider.id, matchingEngineVersion: provider.version, requestedByUserId: actor.actorUserId } });
      const transactions = await tx.transaction.findMany({ where: { businessId: actor.businessId, voidedAt: null, documents: { none: { documentId, unlinkedAt: null } }, postedAt: range(current.evidence.date ?? current.document.documentDate ?? new Date()) }, select: { id: true, amount: true, postedAt: true, description: true, merchantName: true, sourceReference: true, version: true }, orderBy: [{ postedAt: "desc" }, { id: "asc" }], take: 100 });
      const scored = transactions.map((transaction) => ({ transaction, match: provider.score(current.evidence, { ...transaction, amount: transaction.amount.toFixed(2) }, current.currency) })).filter(({ match }) => match.score >= 20).sort((left, right) => right.match.score - left.match.score || left.transaction.postedAt.getTime() - right.transaction.postedAt.getTime() || left.transaction.id.localeCompare(right.transaction.id));
      if (scored.length) await tx.documentMatchSuggestion.createMany({ data: scored.map(({ transaction, match }, index) => ({ businessId: actor.businessId, runId: run.id, transactionId: transaction.id, score: match.score, reasonCodes: match.reasons, rank: index + 1, transactionAmount: transaction.amount, transactionPostedAt: transaction.postedAt, transactionVersion: transaction.version })) });
      await tx.documentMatchHistory.create({ data: { businessId: actor.businessId, runId: run.id, action: "GENERATED", actorUserId: actor.actorUserId, note: `${scored.length} bounded deterministic suggestions` } });
      await tx.documentMatchRun.update({ where: { id: run.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      return { ok: true as const, state: "COMPLETED" as const, runId: run.id };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") { const current = await client.documentMatchRun.findFirst({ where: { businessId: actor.businessId, documentId, status: { in: ["PROCESSING", "COMPLETED"] } }, select: { id: true } }); if (current) return { ok: true as const, state: "EXISTING" as const, runId: current.id }; }
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

export async function decideTransactionMatch(client: Client, actor: TransactionMatchingActor, suggestionId: string, decision: "APPROVE" | "REJECT" | "DISMISS") {
  try {
    return await client.$transaction(async (tx) => {
      const suggestion = await tx.documentMatchSuggestion.findFirst({ where: { id: suggestionId, businessId: actor.businessId }, include: { run: true, transaction: { select: { id: true, amount: true, postedAt: true, version: true, voidedAt: true } } } });
      if (!suggestion) return { ok: false as const, code: "NOT_FOUND" as const };
      if (decision !== "APPROVE") {
        const status = decision === "REJECT" ? "REJECTED" : "DISMISSED";
        if (suggestion.status === status) return { ok: true as const, state: "ALREADY_DECIDED" as const };
        if (suggestion.status !== "SUGGESTED") return { ok: false as const, code: "STALE" as const };
        const updated = await tx.documentMatchSuggestion.updateMany({ where: { id: suggestionId, businessId: actor.businessId, status: "SUGGESTED" }, data: { status, decidedAt: new Date() } });
        if (!updated.count) return { ok: true as const, state: "ALREADY_DECIDED" as const };
        await tx.documentMatchHistory.create({ data: { businessId: actor.businessId, runId: suggestion.runId, suggestionId, action: decision === "REJECT" ? "REJECTED" : "DISMISSED", actorUserId: actor.actorUserId } });
        return { ok: true as const, state: status };
      }
      if (suggestion.status === "APPROVED") return { ok: true as const, state: "ALREADY_APPROVED" as const };
      if (suggestion.status !== "SUGGESTED") return { ok: false as const, code: "STALE" as const };
      const current = await reviewedEvidence(tx, actor.businessId, suggestion.run.documentId);
      const factsChanged = !suggestion.transaction || suggestion.transaction.voidedAt || suggestion.transaction.amount.toFixed(2) !== suggestion.transactionAmount.toFixed(2) || suggestion.transaction.postedAt.getTime() !== suggestion.transactionPostedAt.getTime() || suggestion.transaction.version !== suggestion.transactionVersion;
      const linked = await tx.transactionDocument.findFirst({ where: { businessId: actor.businessId, transactionId: suggestion.transactionId, documentId: suggestion.run.documentId, unlinkedAt: null }, select: { id: true } });
      if (!current || current.attempt.id !== suggestion.run.extractionAttemptId || current.fingerprint !== suggestion.run.evidenceFingerprint || factsChanged || linked) { await staleSuggestion(tx, actor, suggestion.id, suggestion.runId); return { ok: false as const, code: "STALE" as const }; }
      const claimed = await tx.documentMatchSuggestion.updateMany({ where: { id: suggestionId, businessId: actor.businessId, status: "SUGGESTED" }, data: { status: "APPROVED", decidedAt: new Date() } });
      if (!claimed.count) return { ok: true as const, state: "ALREADY_APPROVED" as const };
      const link = await linkDocumentToTransactionInTransaction(tx, actor, suggestion.transactionId, suggestion.run.documentId, "Linked from reviewed suggestion.");
      if (!link.ok || link.state === "ALREADY_LINKED") { await tx.documentMatchSuggestion.update({ where: { id: suggestion.id }, data: { status: "STALE", decidedAt: new Date() } }); await tx.documentMatchHistory.create({ data: { businessId: actor.businessId, runId: suggestion.runId, suggestionId, action: "LINK_FAILED", actorUserId: actor.actorUserId } }); return { ok: false as const, code: "STALE" as const }; }
      await tx.documentMatchHistory.createMany({ data: [{ businessId: actor.businessId, runId: suggestion.runId, suggestionId, action: "APPROVED", actorUserId: actor.actorUserId }, { businessId: actor.businessId, runId: suggestion.runId, suggestionId, action: "LINKED", actorUserId: actor.actorUserId, note: link.linkId }] });
      return { ok: true as const, state: "LINKED" as const, linkId: link.linkId };
    });
  } catch { return { ok: false as const, code: "UNAVAILABLE" as const }; }
}

export async function dismissTransactionMatchRun(client: Client, actor: TransactionMatchingActor, runId: string) {
  try { return await client.$transaction(async (tx) => { const run = await tx.documentMatchRun.findFirst({ where: { id: runId, businessId: actor.businessId }, select: { id: true, status: true } }); if (!run) return { ok: false as const, code: "NOT_FOUND" as const }; if (run.status === "DISMISSED") return { ok: true as const, state: "ALREADY_DISMISSED" as const }; const changed = await tx.documentMatchRun.updateMany({ where: { id: runId, businessId: actor.businessId, status: "COMPLETED" }, data: { status: "DISMISSED" } }); if (!changed.count) return { ok: false as const, code: "STALE" as const }; await tx.documentMatchSuggestion.updateMany({ where: { businessId: actor.businessId, runId, status: "SUGGESTED" }, data: { status: "DISMISSED", decidedAt: new Date() } }); await tx.documentMatchHistory.create({ data: { businessId: actor.businessId, runId, action: "DISMISSED", actorUserId: actor.actorUserId } }); return { ok: true as const, state: "DISMISSED" as const }; }); } catch { return { ok: false as const, code: "UNAVAILABLE" as const }; }
}
