-- Additive owner-approval evidence for the factual fixed-asset lifecycle.
-- This deliberately records no depreciation method, tax election, or journal entry.
ALTER TABLE "FixedAsset"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedByMembershipId" TEXT;

CREATE INDEX "FixedAsset_businessId_approvedAt_idx"
  ON "FixedAsset"("businessId", "approvedAt");
