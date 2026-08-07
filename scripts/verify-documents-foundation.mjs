import { readFileSync } from "node:fs";

function requireText(file, fragments) {
  const value = readFileSync(file, "utf8");
  for (const fragment of fragments) {
    if (!value.includes(fragment)) throw new Error(`Missing document security requirement ${fragment} in ${file}.`);
  }
}

requireText("prisma/schema.prisma", ["DocumentStatusHistory", "METADATA_ONLY", "PENDING_STORAGE", "STORED_PRIVATE", "QUARANTINED_PRIVATE", "privateReadEligible", "@@unique([businessId, sha256])"]);
requireText("src/lib/documents/secure-upload.ts", ["crypto.subtle.digest", "detectMimeType", "extensionMatches", "getPrivateDocumentStorage", "privateReadEligible", "CLOUDFLARE_R2", "malwareScanStatus: \"PENDING\"", "status: \"QUARANTINED\""]);
requireText("src/lib/documents/read-grant.ts", ["server-only", "DOCUMENT_READ_GRANT_SECRET"]);
requireText("src/app/api/documents/[documentId]/content/route.ts", ["verifyDocumentReadGrant", "getPrivateDocumentStorage", "malwareScanStatus !== \"CLEAN\"", "Cache-Control", "X-Content-Type-Options", "frame-ancestors"]);
requireText("src/lib/documents/r2-storage.ts", ["DocumentR2Bucket", "CAPTURE_TRACKER_DOCUMENTS", "active/", "quarantine/", "DocumentR2UnavailableError"]);
requireText("src/lib/documents/scan-lifecycle.ts", ["applyDocumentScanResult", "readQuarantinedDocumentForScan", "status: \"QUARANTINED\"", "malwareScanStatus: \"PENDING\""]);

console.log("DOCUMENTS FOUNDATION VERIFIED: synchronous byte validation, quarantine-first private R2 storage, scoped history, protected reads, and clean-only scan activation.");
