"use server";

import { revalidatePath } from "next/cache";

import { uploadPrivateDocument } from "@/lib/documents/secure-upload";
import { extractDocument, reviewDocumentExtraction } from "@/lib/documents/extraction";
import { decideDocumentTransactionMatch, dismissDocumentTransactionMatchRun, generateDocumentTransactionMatches } from "@/lib/documents/transaction-matching";
import { requireBusinessContext } from "@/lib/security/business-context";

export type DocumentUploadState = {
  code?: "INVALID" | "STORAGE" | "UNAVAILABLE";
  documentId?: string;
  outcome?: "ACTIVE" | "EXISTING";
  message?: string;
  ok: boolean;
};
export type ExtractionActionState = { ok: boolean; message?: string };
export type DocumentMatchingActionState = { ok: boolean; message?: string };
const idPattern = /^[A-Za-z0-9_-]{1,191}$/;
export async function runAuthenticatedExtraction(_: ExtractionActionState, formData: FormData): Promise<ExtractionActionState> {
  const documentId = String(formData.get("documentId") ?? "");
  if (!idPattern.test(documentId)) return { ok: false, message: "The extraction request is invalid." };
  try { const context = await requireBusinessContext(); const result = await extractDocument({ businessId: context.business.id, actorUserId: context.user.id }, documentId); if (!result.ok) return { ok: false, message: result.code === "INELIGIBLE" ? "Extraction is available only for active private PDF, JPEG, or PNG documents." : result.code === "NOT_FOUND" ? "Document not found." : "Fictional extraction could not complete safely." }; revalidatePath(`/app/documents/${documentId}`); revalidatePath("/app/documents"); return { ok: true, message: result.state === "EXISTING" ? "An extraction for this document version already exists." : "Fictional extraction completed. Review the evidence below." }; } catch { return { ok: false, message: "Extraction could not complete safely." }; }
}
export async function reviewAuthenticatedExtraction(_: ExtractionActionState, formData: FormData): Promise<ExtractionActionState> {
  const candidateId = String(formData.get("candidateId") ?? ""); const documentId = String(formData.get("documentId") ?? ""); const review = String(formData.get("review") ?? ""); const correctedValue = String(formData.get("correctedValue") ?? "");
  if (!idPattern.test(candidateId) || !idPattern.test(documentId) || !["ACCEPTED", "CORRECTED", "REJECTED"].includes(review)) return { ok: false, message: "The review request is invalid." };
  try { const context = await requireBusinessContext(); const result = await reviewDocumentExtraction({ businessId: context.business.id, actorUserId: context.user.id }, candidateId, review as "ACCEPTED" | "CORRECTED" | "REJECTED", correctedValue || undefined); if (!result.ok) return { ok: false, message: result.code === "STALE" ? "This extraction is stale and cannot be reviewed." : "The extraction review could not be saved safely." }; revalidatePath(`/app/documents/${documentId}`); return { ok: true, message: result.state === "ALREADY_REVIEWED" ? "This field was already reviewed." : "Extraction evidence review saved." }; } catch { return { ok: false, message: "The extraction review could not be authorized." }; }
}
export async function runAuthenticatedDocumentMatching(_: DocumentMatchingActionState, formData: FormData): Promise<DocumentMatchingActionState> {
  const documentId = String(formData.get("documentId") ?? ""); if (!idPattern.test(documentId)) return { ok: false, message: "The matching request is invalid." };
  try { const context = await requireBusinessContext(); const result = await generateDocumentTransactionMatches({ businessId: context.business.id, actorUserId: context.user.id }, documentId); if (!result.ok) return { ok: false, message: result.code === "INELIGIBLE" ? "Suggestions require current, reviewed extraction evidence on an active private document." : "Suggestions could not be generated safely." }; revalidatePath(`/app/documents/${documentId}`); return { ok: true, message: result.state === "EXISTING" ? "Current suggestions already exist for this reviewed evidence." : "Suggested transactions are ready for your review." }; } catch { return { ok: false, message: "Suggestions could not be authorized." }; }
}
export async function decideAuthenticatedDocumentMatching(_: DocumentMatchingActionState, formData: FormData): Promise<DocumentMatchingActionState> {
  const documentId = String(formData.get("documentId") ?? ""); const suggestionId = String(formData.get("suggestionId") ?? ""); const decision = String(formData.get("decision") ?? ""); if (!idPattern.test(documentId) || !idPattern.test(suggestionId) || !["APPROVE", "REJECT", "DISMISS"].includes(decision)) return { ok: false, message: "The suggestion decision is invalid." };
  try { const context = await requireBusinessContext(); const result = await decideDocumentTransactionMatch({ businessId: context.business.id, actorUserId: context.user.id }, suggestionId, decision as "APPROVE" | "REJECT" | "DISMISS"); if (!result.ok) return { ok: false, message: result.code === "STALE" ? "This suggestion is stale and cannot be approved." : "The suggestion could not be changed safely." }; revalidatePath(`/app/documents/${documentId}`); revalidatePath("/app/money"); return { ok: true, message: result.state === "LINKED" ? "The document was linked through the normal document-link workflow." : "Suggestion decision saved." }; } catch { return { ok: false, message: "The suggestion decision could not be authorized." }; }
}
export async function dismissAuthenticatedDocumentMatchingRun(_: DocumentMatchingActionState, formData: FormData): Promise<DocumentMatchingActionState> {
  const documentId = String(formData.get("documentId") ?? ""); const runId = String(formData.get("runId") ?? ""); if (!idPattern.test(documentId) || !idPattern.test(runId)) return { ok: false, message: "The suggestion run is invalid." };
  try { const context = await requireBusinessContext(); const result = await dismissDocumentTransactionMatchRun({ businessId: context.business.id, actorUserId: context.user.id }, runId); if (!result.ok) return { ok: false, message: "The suggestion run could not be dismissed safely." }; revalidatePath(`/app/documents/${documentId}`); return { ok: true, message: "The suggestion run was dismissed." }; } catch { return { ok: false, message: "The suggestion run could not be authorized." }; }
}

export async function uploadDocument(_: DocumentUploadState, formData: FormData): Promise<DocumentUploadState> {
  const file = formData.get("document");
  if (!(file instanceof File) || !file.name) return { ok: false, code: "INVALID", message: "Choose a PDF, JPEG, or PNG file first." };

  try {
    const context = await requireBusinessContext();
    const result = await uploadPrivateDocument({ businessId: context.business.id, actorUserId: context.user.id }, file);
    if (!result.ok) {
      const code = result.code === "INVALID" || result.code === "STORAGE" ? result.code : "UNAVAILABLE";
      return { ok: false, code, message: result.message };
    }
    revalidatePath("/app/documents");
    return {
      ok: true,
      documentId: result.documentId,
      outcome: result.outcome,
      message: result.duplicate ? "This file already has a canonical document record." : undefined,
    };
  } catch {
    return { ok: false, code: "UNAVAILABLE", message: "Private document storage is unavailable. Please try again." };
  }
}
