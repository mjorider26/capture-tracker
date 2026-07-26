"use server";

import { revalidatePath } from "next/cache";

import { uploadFictionalDocument } from "@/lib/documents/secure-upload";
import { extractDocument, reviewDocumentExtraction } from "@/lib/documents/extraction";
import { requireBusinessContext } from "@/lib/security/business-context";

export type DocumentUploadState = {
  code?: "INVALID" | "STORAGE" | "UNAVAILABLE";
  documentId?: string;
  outcome?: "ACTIVE" | "QUARANTINED" | "SCANNER_ERROR" | "EXISTING";
  message?: string;
  ok: boolean;
};
export type ExtractionActionState = { ok: boolean; message?: string };
const idPattern = /^[A-Za-z0-9_-]{1,191}$/;
export async function runAuthenticatedExtraction(_: ExtractionActionState, formData: FormData): Promise<ExtractionActionState> {
  const documentId = String(formData.get("documentId") ?? "");
  if (!idPattern.test(documentId)) return { ok: false, message: "The extraction request is invalid." };
  try { const context = await requireBusinessContext(); const result = await extractDocument({ businessId: context.business.id, actorUserId: context.user.id }, documentId); if (!result.ok) return { ok: false, message: result.code === "INELIGIBLE" ? "Extraction is available only for active, clean private PDF, JPEG, or PNG documents." : result.code === "NOT_FOUND" ? "Document not found." : "Fictional extraction could not complete safely." }; revalidatePath(`/app/documents/${documentId}`); revalidatePath("/app/documents"); return { ok: true, message: result.state === "EXISTING" ? "An extraction for this document version already exists." : "Fictional extraction completed. Review the evidence below." }; } catch { return { ok: false, message: "Extraction is unavailable because no approved production provider is configured." }; }
}
export async function reviewAuthenticatedExtraction(_: ExtractionActionState, formData: FormData): Promise<ExtractionActionState> {
  const candidateId = String(formData.get("candidateId") ?? ""); const documentId = String(formData.get("documentId") ?? ""); const review = String(formData.get("review") ?? ""); const correctedValue = String(formData.get("correctedValue") ?? "");
  if (!idPattern.test(candidateId) || !idPattern.test(documentId) || !["ACCEPTED", "CORRECTED", "REJECTED"].includes(review)) return { ok: false, message: "The review request is invalid." };
  try { const context = await requireBusinessContext(); const result = await reviewDocumentExtraction({ businessId: context.business.id, actorUserId: context.user.id }, candidateId, review as "ACCEPTED" | "CORRECTED" | "REJECTED", correctedValue || undefined); if (!result.ok) return { ok: false, message: result.code === "STALE" ? "This extraction is stale and cannot be reviewed." : "The extraction review could not be saved safely." }; revalidatePath(`/app/documents/${documentId}`); return { ok: true, message: result.state === "ALREADY_REVIEWED" ? "This field was already reviewed." : "Extraction evidence review saved." }; } catch { return { ok: false, message: "The extraction review could not be authorized." }; }
}

export async function uploadDocument(_: DocumentUploadState, formData: FormData): Promise<DocumentUploadState> {
  const file = formData.get("document");
  if (!(file instanceof File) || !file.name) return { ok: false, code: "INVALID", message: "Choose a PDF, JPEG, or PNG file first." };

  try {
    const context = await requireBusinessContext();
    const result = await uploadFictionalDocument({ businessId: context.business.id, actorUserId: context.user.id }, file);
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
    return { ok: false, code: "UNAVAILABLE", message: "Secure fictional upload is unavailable." };
  }
}
