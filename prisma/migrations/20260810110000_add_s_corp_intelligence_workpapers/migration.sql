-- V2.1 factual S-Corp workpapers. These tables deliberately do not backfill or
-- calculate taxpayer basis, tax deductions, legal conclusions, or return positions.
CREATE TABLE "ShareholderBasisWorkpaper" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "openingStockBasis" DECIMAL(18,2),
  "openingDebtBasis" DECIMAL(18,2),
  "effectiveDate" TIMESTAMP(3),
  "sourceReference" VARCHAR(500),
  "notes" TEXT,
  "enteredByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "ownerConfirmedByUserId" TEXT,
  "ownerConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ShareholderBasisWorkpaper_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShareholderBasisWorkpaper_businessId_taxYear_key" ON "ShareholderBasisWorkpaper"("businessId", "taxYear");
CREATE INDEX "ShareholderBasisWorkpaper_businessId_taxYear_idx" ON "ShareholderBasisWorkpaper"("businessId", "taxYear");

CREATE TABLE "ShareholderBasisAdjustment" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "workpaperId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "source" VARCHAR(500) NOT NULL,
  "documentReference" VARCHAR(500),
  "confirmedByUserId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ShareholderBasisAdjustment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShareholderBasisAdjustment_businessId_taxYear_idx" ON "ShareholderBasisAdjustment"("businessId", "taxYear");
CREATE INDEX "ShareholderBasisAdjustment_workpaperId_createdAt_idx" ON "ShareholderBasisAdjustment"("workpaperId", "createdAt");

CREATE TABLE "ShareholderDebtInstrument" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "loanDate" TIMESTAMP(3) NOT NULL,
  "label" VARCHAR(180) NOT NULL,
  "originalPrincipal" DECIMAL(18,2) NOT NULL,
  "outstandingPrincipal" DECIMAL(18,2) NOT NULL,
  "taxBasisAmount" DECIMAL(18,2),
  "writtenNoteReference" VARCHAR(500),
  "accountingReference" VARCHAR(500),
  "cpaNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ShareholderDebtInstrument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShareholderDebtInstrument_businessId_loanDate_idx" ON "ShareholderDebtInstrument"("businessId", "loanDate");

CREATE TABLE "DistributionReadinessSnapshot" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "ownerDistributionId" TEXT,
  "status" VARCHAR(48) NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DistributionReadinessSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DistributionReadinessSnapshot_businessId_createdAt_idx" ON "DistributionReadinessSnapshot"("businessId", "createdAt");
CREATE UNIQUE INDEX "DistributionReadinessSnapshot_businessId_ownerDistributionId_key" ON "DistributionReadinessSnapshot"("businessId", "ownerDistributionId");

CREATE TABLE "AccountingPolicy" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "policyType" VARCHAR(64) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "AccountingPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountingPolicy_currentVersionId_key" ON "AccountingPolicy"("currentVersionId");
CREATE UNIQUE INDEX "AccountingPolicy_businessId_policyType_key" ON "AccountingPolicy"("businessId", "policyType");

CREATE TABLE "AccountingPolicyVersion" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "content" TEXT NOT NULL,
  "reason" TEXT,
  "changedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountingPolicyVersion_businessId_effectiveDate_idx" ON "AccountingPolicyVersion"("businessId", "effectiveDate");
CREATE INDEX "AccountingPolicyVersion_policyId_effectiveDate_idx" ON "AccountingPolicyVersion"("policyId", "effectiveDate");

CREATE TABLE "AccountingPolicyApplication" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "entityType" VARCHAR(64) NOT NULL,
  "entityId" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingPolicyApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountingPolicyApplication_businessId_policyVersionId_entityType_entityId_key" ON "AccountingPolicyApplication"("businessId", "policyVersionId", "entityType", "entityId");
CREATE INDEX "AccountingPolicyApplication_businessId_entityType_entityId_idx" ON "AccountingPolicyApplication"("businessId", "entityType", "entityId");

CREATE TABLE "ShareholderBenefitWorkpaper" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "taxYear" INTEGER NOT NULL,
  "benefitType" VARCHAR(64) NOT NULL,
  "provider" VARCHAR(180),
  "coverageStart" TIMESTAMP(3),
  "coverageEnd" TIMESTAMP(3),
  "premiumAmount" DECIMAL(18,2),
  "paymentMethod" VARCHAR(64),
  "payrollInclusionStatus" VARCHAR(48) NOT NULL DEFAULT 'INCOMPLETE',
  "w2WorkpaperStatus" VARCHAR(48) NOT NULL DEFAULT 'INCOMPLETE',
  "documentReference" VARCHAR(500),
  "cpaReviewStatus" VARCHAR(48) NOT NULL DEFAULT 'CPA_REVIEW',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ShareholderBenefitWorkpaper_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShareholderBenefitWorkpaper_businessId_taxYear_idx" ON "ShareholderBenefitWorkpaper"("businessId", "taxYear");

ALTER TABLE "ShareholderBasisWorkpaper" ADD CONSTRAINT "ShareholderBasisWorkpaper_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareholderBasisAdjustment" ADD CONSTRAINT "ShareholderBasisAdjustment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareholderBasisAdjustment" ADD CONSTRAINT "ShareholderBasisAdjustment_workpaperId_fkey" FOREIGN KEY ("workpaperId") REFERENCES "ShareholderBasisWorkpaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareholderDebtInstrument" ADD CONSTRAINT "ShareholderDebtInstrument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributionReadinessSnapshot" ADD CONSTRAINT "DistributionReadinessSnapshot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DistributionReadinessSnapshot" ADD CONSTRAINT "DistributionReadinessSnapshot_businessId_ownerDistributionId_fkey" FOREIGN KEY ("businessId", "ownerDistributionId") REFERENCES "OwnerDistribution"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicy" ADD CONSTRAINT "AccountingPolicy_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicyVersion" ADD CONSTRAINT "AccountingPolicyVersion_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicyVersion" ADD CONSTRAINT "AccountingPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AccountingPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicyApplication" ADD CONSTRAINT "AccountingPolicyApplication_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicyApplication" ADD CONSTRAINT "AccountingPolicyApplication_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "AccountingPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingPolicy" ADD CONSTRAINT "AccountingPolicy_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AccountingPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShareholderBenefitWorkpaper" ADD CONSTRAINT "ShareholderBenefitWorkpaper_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
