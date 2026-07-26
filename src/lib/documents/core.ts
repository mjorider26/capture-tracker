import { z } from "zod";

export const DOCUMENT_MAX_METADATA_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_RETENTION_YEARS = 7;
export const approvedDocumentMimeTypes = ["application/pdf", "image/jpeg", "image/png"] as const;
export const documentCategories = ["RECEIPT", "BANK_STATEMENT", "TAX_DOCUMENT", "PAYROLL_DOCUMENT", "OTHER"] as const;
export type DocumentStatusValue = "PENDING_VALIDATION" | "ACTIVE" | "QUARANTINED";

export const documentMetadataSchema = z.object({
  originalFilename: z.string().trim().min(1).max(180), displayName: z.string().trim().min(1).max(180),
  mimeType: z.enum(approvedDocumentMimeTypes), sizeBytes: z.number().int().positive().max(DOCUMENT_MAX_METADATA_BYTES),
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/), category: z.enum(documentCategories),
  documentDate: z.coerce.date().optional(),
});

export function normalizeDocumentFilename(value: string) {
  const name = value.trim().replace(/\\/g, "/");
  if (!name || name.includes("/") || name === "." || name === ".." || /^[A-Za-z]:/.test(name)) throw new Error("Filename must not contain a path.");
  return name.replace(/[\u0000-\u001f]/g, "").slice(0, 180);
}
export function calculateDocumentRetentionUntil(baseline: Date) {
  const result = new Date(baseline);
  result.setUTCFullYear(result.getUTCFullYear() + DOCUMENT_RETENTION_YEARS);
  return result;
}
export function canTransitionDocument(from: DocumentStatusValue, to: DocumentStatusValue) {
  return from === "PENDING_VALIDATION" && (to === "ACTIVE" || to === "QUARANTINED");
}
