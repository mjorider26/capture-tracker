CREATE TYPE "OperatorInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "OperatorInvitation" (
  "id" TEXT NOT NULL,
  "invitedEmail" VARCHAR(320) NOT NULL,
  "ownerDisplayName" VARCHAR(120) NOT NULL,
  "businessLegalName" VARCHAR(160) NOT NULL,
  "businessDisplayName" VARCHAR(160) NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "provisionedBusinessId" TEXT,
  "status" "OperatorInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OperatorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperatorInvitation_tokenHash_key" ON "OperatorInvitation"("tokenHash");
CREATE UNIQUE INDEX "OperatorInvitation_provisionedBusinessId_key" ON "OperatorInvitation"("provisionedBusinessId");
CREATE INDEX "OperatorInvitation_invitedEmail_status_expiresAt_idx" ON "OperatorInvitation"("invitedEmail", "status", "expiresAt");
CREATE INDEX "OperatorInvitation_createdByUserId_status_createdAt_idx" ON "OperatorInvitation"("createdByUserId", "status", "createdAt");

ALTER TABLE "BusinessOnboarding"
  ADD COLUMN "cutoverDate" TIMESTAMP(3),
  ADD COLUMN "openingBalancesPosted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownerMoneyInitialized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "payrollYtdEstablished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fixedAssetsReviewed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "initialReconciliationComplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "booksCurrentThrough" TIMESTAMP(3);

CREATE TABLE "BusinessCutover" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "sourceReference" VARCHAR(300),
  "openingJournalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BusinessCutover_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessCutover_businessId_key" ON "BusinessCutover"("businessId");
CREATE UNIQUE INDEX "BusinessCutover_openingJournalId_key" ON "BusinessCutover"("openingJournalId");
ALTER TABLE "BusinessCutover" ADD CONSTRAINT "BusinessCutover_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
