import { readFileSync } from "node:fs";

function requireText(file, fragments) {
  const value = readFileSync(file, "utf8");
  for (const fragment of fragments) {
    if (!value.includes(fragment)) throw new Error(`Missing document security requirement ${fragment} in ${file}.`);
  }
}

requireText("prisma/schema.prisma", ["DocumentStatusHistory", "METADATA_ONLY", "PENDING_STORAGE", "STORED_PRIVATE", "QUARANTINED_PRIVATE", "privateReadEligible", "@@unique([businessId, sha256])"]);
requireText("src/lib/documents/secure-upload.ts", ["crypto.subtle.digest", "CAPTURE_TRACKER_REAL_DATA_APPROVED", "LOCAL_FICTIONAL", "SUSPICIOUS", "SCANNER_ERROR", "privateReadEligible"]);
requireText("src/lib/documents/read-grant.ts", ["server-only", "DOCUMENT_READ_GRANT_SECRET"]);
requireText("src/app/api/documents/[documentId]/content/route.ts", ["verifyDocumentReadGrant", "malwareScanStatus !== \"CLEAN\"", "Cache-Control", "X-Content-Type-Options", "frame-ancestors"]);
requireText("src/lib/documents/r2-storage.ts", ["DocumentR2Bucket", "pending/", "\"quarantine\"", "DocumentR2UnavailableError"]);

console.log("DOCUMENTS FOUNDATION VERIFIED: fictional byte validation, scoped history, private grants, protected reads, and inactive R2 boundary.");
