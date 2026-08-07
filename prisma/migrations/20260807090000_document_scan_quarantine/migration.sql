-- New uploads are quarantined before their private bytes can be read. Keep
-- historical pilot records explicitly readable under their accurate
-- NOT_STARTED status; this migration does not invent clean scan results.
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_secure_storage_state";

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
      AND "malwareScanStatus" IN ('PENDING', 'FAILED', 'INFECTED')
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
