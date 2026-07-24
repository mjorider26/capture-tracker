-- Add an opaque, immutable payment intent key. PostgreSQL unique constraints
-- allow multiple NULLs, preserving historical payments without keys.
ALTER TABLE "TaxPaymentRecord" ADD COLUMN "idempotencyKey" VARCHAR(64);

CREATE UNIQUE INDEX "TaxPaymentRecord_businessId_estimateId_idempotencyKey_key"
ON "TaxPaymentRecord"("businessId", "estimateId", "idempotencyKey");
