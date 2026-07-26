"use server";

import { revalidatePath } from "next/cache";

import { uploadFictionalDocument } from "@/lib/documents/secure-upload";
import { requireBusinessContext } from "@/lib/security/business-context";

export type DocumentUploadState = {
  code?: "INVALID" | "STORAGE" | "UNAVAILABLE";
  documentId?: string;
  outcome?: "ACTIVE" | "QUARANTINED" | "SCANNER_ERROR" | "EXISTING";
  message?: string;
  ok: boolean;
};

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
