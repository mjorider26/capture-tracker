ALTER TABLE "Document" DROP CONSTRAINT "Document_metadata_only_integrity";

ALTER TABLE "Document"
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "storedSizeBytes" BIGINT,
  ADD COLUMN "objectVersion" TEXT,
  ADD COLUMN "uploadCompletedAt" TIMESTAMP(3),
  ADD COLUMN "privateReadEligible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Document" ADD CONSTRAINT "Document_secure_storage_state"
  CHECK (("storageState" = 'METADATA_ONLY' AND "storageKey" IS NULL AND "storageProvider" IS NULL AND "malwareScanProvider" IS NULL OR "storageState" <> 'METADATA_ONLY')
    AND "sha256" ~ '^[0-9a-f]{64}$' AND "sizeBytes" > 0 AND "sizeBytes" <= 10485760
    AND ("status" <> 'ACTIVE' OR ("storageState" = 'STORED_PRIVATE' AND "malwareScanStatus" = 'CLEAN' AND "privateReadEligible"))
    AND ("status" <> 'QUARANTINED' OR ("storageState" = 'QUARANTINED_PRIVATE' AND "malwareScanStatus" = 'INFECTED' AND NOT "privateReadEligible"))
    AND ("privateReadEligible" = false OR ("status" = 'ACTIVE' AND "storageState" = 'STORED_PRIVATE' AND "malwareScanStatus" = 'CLEAN')));
