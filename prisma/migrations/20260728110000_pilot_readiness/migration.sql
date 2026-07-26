CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "ExportKind" AS ENUM ('TRANSACTIONS', 'JOURNAL', 'ACCOUNTS', 'REPORTS', 'DOCUMENTS', 'DOCUMENT_LINKS', 'WEEKLY_REVIEW', 'ASK_AI');

CREATE TABLE "BusinessOnboarding" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "ownerDisplayName" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "fictionalAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "chartConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessOnboarding_businessId_key" UNIQUE ("businessId"),
  CONSTRAINT "BusinessOnboarding_businessId_id_key" UNIQUE ("businessId", "id")
);
CREATE TABLE "BusinessSettings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "defaultReportPeriod" VARCHAR(24) NOT NULL DEFAULT 'month',
  "weeklyReviewDay" INTEGER NOT NULL DEFAULT 1,
  "retentionMonths" INTEGER NOT NULL DEFAULT 84,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessSettings_businessId_key" UNIQUE ("businessId"),
  CONSTRAINT "BusinessSettings_businessId_id_key" UNIQUE ("businessId", "id")
);
CREATE TABLE "BusinessSettingsHistory" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "changedJson" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSettingsHistory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExportAudit" (
  "id" TEXT NOT NULL, "businessId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "kind" "ExportKind" NOT NULL, "rowCount" INTEGER NOT NULL, "manifest" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BusinessSettingsHistory_businessId_createdAt_idx" ON "BusinessSettingsHistory"("businessId", "createdAt");
CREATE INDEX "ExportAudit_businessId_createdAt_idx" ON "ExportAudit"("businessId", "createdAt");
ALTER TABLE "BusinessOnboarding" ADD CONSTRAINT "BusinessOnboarding_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessOnboarding" ADD CONSTRAINT "BusinessOnboarding_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessSettingsHistory" ADD CONSTRAINT "BusinessSettingsHistory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessSettingsHistory" ADD CONSTRAINT "BusinessSettingsHistory_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportAudit" ADD CONSTRAINT "ExportAudit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportAudit" ADD CONSTRAINT "ExportAudit_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
