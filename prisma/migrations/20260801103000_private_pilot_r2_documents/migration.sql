-- The private single-owner pilot performs strict synchronous validation before
-- storing an object in private R2. Malware scanning is intentionally deferred
-- until untrusted upload access is introduced, so ACTIVE documents may retain
-- the accurate NOT_STARTED scan state.
ALTER TABLE "Document" DROP CONSTRAINT "Document_secure_storage_state";

ALTER TABLE "Document" ADD CONSTRAINT "Document_secure_storage_state"
  CHECK ((
    ("storageState" = 'METADATA_ONLY' AND "storageKey" IS NULL AND "storageProvider" IS NULL AND "malwareScanProvider" IS NULL)
    OR "storageState" <> 'METADATA_ONLY'
  )
  AND "sha256" ~ '^[0-9a-f]{64}$'
  AND "sizeBytes" > 0
  AND "sizeBytes" <= 10485760
  AND (
    "status" <> 'ACTIVE'
    OR (
      "storageState" = 'STORED_PRIVATE'
      AND "privateReadEligible"
      AND "malwareScanStatus" IN ('CLEAN', 'NOT_STARTED')
    )
  )
  AND (
    "status" <> 'QUARANTINED'
    OR (
      "storageState" = 'QUARANTINED_PRIVATE'
      AND "malwareScanStatus" = 'INFECTED'
      AND NOT "privateReadEligible"
    )
  )
  AND (
    NOT "privateReadEligible"
    OR (
      "status" = 'ACTIVE'
      AND "storageState" = 'STORED_PRIVATE'
      AND "malwareScanStatus" IN ('CLEAN', 'NOT_STARTED')
    )
  ));
