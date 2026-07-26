-- Phase 10A is metadata-only. Existing forward-looking document columns remain
-- for linked accounting records, but no storage provider is configured here.
CREATE TYPE "DocumentCategory" AS ENUM ('RECEIPT', 'BANK_STATEMENT', 'TAX_DOCUMENT', 'PAYROLL_DOCUMENT', 'OTHER');
CREATE TYPE "DocumentStorageState" AS ENUM ('METADATA_ONLY');

ALTER TABLE "Document"
  ALTER COLUMN "storageKey" DROP NOT NULL,
  ALTER COLUMN "malwareScanProvider" DROP DEFAULT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "category" "DocumentCategory",
  ADD COLUMN "storageState" "DocumentStorageState" NOT NULL DEFAULT 'METADATA_ONLY',
  ADD COLUMN "documentDate" TIMESTAMP(3),
  ADD COLUMN "quarantineReasonCode" TEXT,
  ADD COLUMN "quarantineExplanation" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Document"
SET "displayName" = "originalFilename",
    "category" = CASE "type"
      WHEN 'RECEIPT' THEN 'RECEIPT'::"DocumentCategory"
      WHEN 'BANK_STATEMENT' THEN 'BANK_STATEMENT'::"DocumentCategory"
      WHEN 'TAX_FORM' THEN 'TAX_DOCUMENT'::"DocumentCategory"
      WHEN 'PAYROLL_REPORT' THEN 'PAYROLL_DOCUMENT'::"DocumentCategory"
      ELSE 'OTHER'::"DocumentCategory"
    END,
    "retentionUntil" = COALESCE("retentionUntil", "uploadedAt" + INTERVAL '7 years'),
    "createdAt" = "uploadedAt",
    "updatedAt" = "uploadedAt";

ALTER TABLE "Document"
  ALTER COLUMN "displayName" SET NOT NULL,
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "retentionUntil" SET NOT NULL;

CREATE TABLE "DocumentStatusHistory" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "previousStatus" "DocumentStatus",
  "newStatus" "DocumentStatus" NOT NULL,
  "reasonCode" TEXT,
  "note" TEXT,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_businessId_sha256_key" ON "Document"("businessId", "sha256");
CREATE UNIQUE INDEX "DocumentStatusHistory_businessId_id_key" ON "DocumentStatusHistory"("businessId", "id");
CREATE INDEX "DocumentStatusHistory_businessId_documentId_createdAt_idx" ON "DocumentStatusHistory"("businessId", "documentId", "createdAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_metadata_only_integrity"
  CHECK ("storageState" = 'METADATA_ONLY' AND "storageKey" IS NULL AND "malwareScanProvider" IS NULL
    AND "sha256" ~ '^[0-9a-f]{64}$' AND "sizeBytes" > 0 AND "sizeBytes" <= 10485760
    AND "mimeType" IN ('application/pdf', 'image/jpeg', 'image/png')
    AND "status" IN ('PENDING_VALIDATION', 'ACTIVE', 'QUARANTINED')
    AND (("status" = 'QUARANTINED' AND "quarantineReasonCode" IS NOT NULL)
      OR ("status" <> 'QUARANTINED' AND "quarantineReasonCode" IS NULL AND "quarantineExplanation" IS NULL))
    AND "retentionUntil" > COALESCE("documentDate", "createdAt"));

ALTER TABLE "DocumentStatusHistory" ADD CONSTRAINT "DocumentStatusHistory_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentStatusHistory" ADD CONSTRAINT "DocumentStatusHistory_businessId_documentId_fkey"
  FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentStatusHistory" ADD CONSTRAINT "DocumentStatusHistory_businessId_actorUserId_fkey"
  FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
