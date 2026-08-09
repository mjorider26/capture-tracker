-- Owner-controlled CPA document visibility. Existing tenants remain fail-closed.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "cpaDocumentAccess" BOOLEAN NOT NULL DEFAULT FALSE;
