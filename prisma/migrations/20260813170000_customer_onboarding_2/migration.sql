CREATE TYPE "OnboardingPhase" AS ENUM (
  'WELCOME_PENDING',
  'BUSINESS_CONFIRMATION',
  'BANK_ACTIVITY_CHOICE',
  'PLAID_CONNECTION',
  'MANUAL_ACTIVITY',
  'STARTING_BOOKS_IN_PROGRESS',
  'INITIAL_ACTIVITY_REVIEW',
  'RECONCILIATION_REQUIRED',
  'READINESS_CHECK',
  'TOUR_PENDING',
  'COMPLETE'
);

ALTER TABLE "BusinessOnboarding"
  ADD COLUMN "phase" "OnboardingPhase" NOT NULL DEFAULT 'WELCOME_PENDING',
  ADD COLUMN "businessConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accountSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "initialActivityReviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "readinessConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accountingBasisReviewStatus" VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "ownerMoneyContext" VARCHAR(48),
  ADD COLUMN "payrollContext" VARCHAR(48),
  ADD COLUMN "fixedAssetsContext" VARCHAR(48),
  ADD COLUMN "tourStep" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tourCompletedAt" TIMESTAMP(3);

UPDATE "BusinessOnboarding"
SET "phase" = 'COMPLETE',
    "businessConfirmed" = true,
    "accountSetupCompleted" = true,
    "initialActivityReviewed" = true,
    "readinessConfirmed" = true,
    "tourStep" = 5,
    "tourCompletedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'COMPLETED';
