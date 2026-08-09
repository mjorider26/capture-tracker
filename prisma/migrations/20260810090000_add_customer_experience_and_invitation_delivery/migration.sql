-- Presentation and delivery state only. Neither field participates in tenant
-- authorization, identity, balances, journals, or any accounting calculation.
ALTER TABLE "Business"
  ADD COLUMN "customerExperience" VARCHAR(32) NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "OperatorInvitation"
  ADD COLUMN "customerExperience" VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "emailDeliveryStatus" VARCHAR(32) NOT NULL DEFAULT 'MANUAL_REQUIRED',
  ADD COLUMN "emailDeliveryAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "emailDeliveryError" VARCHAR(200);
