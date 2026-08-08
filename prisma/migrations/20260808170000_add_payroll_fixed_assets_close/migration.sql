CREATE TYPE "PayrollMatchStatus" AS ENUM ('UNMATCHED', 'PARTIAL', 'MATCHED', 'DIFFERENCE');
CREATE TYPE "FixedAssetStatus" AS ENUM ('POSSIBLE_REVIEW', 'IN_SERVICE', 'DISPOSED', 'VOIDED');
CREATE TYPE "MonthEndCloseStatus" AS ENUM ('NOT_READY', 'READY_TO_CLOSE', 'CLOSED');

ALTER TABLE "PayrollRun"
  ADD COLUMN "federalWithholding" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "stateLocalWithholding" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employeeSocialSecurity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employeeMedicare" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employerSocialSecurity" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employerMedicare" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "otherEmployerPayrollTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "providerFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "cashAccountId" TEXT;

CREATE TABLE "PayrollBankMatch" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "externalTransactionId" TEXT NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "expectedAmount" DECIMAL(18,2) NOT NULL,
  "matchedAmount" DECIMAL(18,2) NOT NULL,
  "status" "PayrollMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "notes" TEXT,
  "matchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PayrollBankMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReasonableCompWorkpaper" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "effectiveStart" TIMESTAMP(3) NOT NULL,
  "effectiveEnd" TIMESTAMP(3),
  "targetLow" DECIMAL(18,2),
  "targetHigh" DECIMAL(18,2),
  "supportingNotes" TEXT NOT NULL,
  "reviewDate" TIMESTAMP(3),
  "documentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ReasonableCompWorkpaper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FixedAsset" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "vendor" VARCHAR(180),
  "acquisitionDate" TIMESTAMP(3) NOT NULL,
  "acquisitionCost" DECIMAL(18,2) NOT NULL,
  "placedInServiceDate" TIMESTAMP(3),
  "dispositionDate" TIMESTAMP(3),
  "dispositionProceeds" DECIMAL(18,2),
  "status" "FixedAssetStatus" NOT NULL DEFAULT 'POSSIBLE_REVIEW',
  "sourceExternalTransactionId" TEXT,
  "sourceTransactionId" TEXT,
  "documentId" TEXT,
  "workpaperNotes" TEXT,
  "cpaNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthEndClose" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "MonthEndCloseStatus" NOT NULL DEFAULT 'NOT_READY',
  "checklistJson" JSONB NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MonthEndClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollBankMatch_businessId_id_key" ON "PayrollBankMatch"("businessId", "id");
CREATE UNIQUE INDEX "PayrollBankMatch_businessId_payrollRunId_externalTransactionId_kind_key" ON "PayrollBankMatch"("businessId", "payrollRunId", "externalTransactionId", "kind");
CREATE INDEX "PayrollBankMatch_businessId_status_idx" ON "PayrollBankMatch"("businessId", "status");
CREATE UNIQUE INDEX "ReasonableCompWorkpaper_businessId_id_key" ON "ReasonableCompWorkpaper"("businessId", "id");
CREATE INDEX "ReasonableCompWorkpaper_businessId_effectiveStart_idx" ON "ReasonableCompWorkpaper"("businessId", "effectiveStart");
CREATE UNIQUE INDEX "FixedAsset_businessId_id_key" ON "FixedAsset"("businessId", "id");
CREATE INDEX "FixedAsset_businessId_status_idx" ON "FixedAsset"("businessId", "status");
CREATE INDEX "FixedAsset_businessId_acquisitionDate_idx" ON "FixedAsset"("businessId", "acquisitionDate");
CREATE UNIQUE INDEX "MonthEndClose_businessId_periodStart_periodEnd_key" ON "MonthEndClose"("businessId", "periodStart", "periodEnd");
CREATE INDEX "MonthEndClose_businessId_status_periodEnd_idx" ON "MonthEndClose"("businessId", "status", "periodEnd");

ALTER TABLE "PayrollBankMatch" ADD CONSTRAINT "PayrollBankMatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollBankMatch" ADD CONSTRAINT "PayrollBankMatch_businessId_payrollRunId_fkey" FOREIGN KEY ("businessId", "payrollRunId") REFERENCES "PayrollRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollBankMatch" ADD CONSTRAINT "PayrollBankMatch_businessId_externalTransactionId_fkey" FOREIGN KEY ("businessId", "externalTransactionId") REFERENCES "ExternalTransaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReasonableCompWorkpaper" ADD CONSTRAINT "ReasonableCompWorkpaper_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReasonableCompWorkpaper" ADD CONSTRAINT "ReasonableCompWorkpaper_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_businessId_sourceExternalTransactionId_fkey" FOREIGN KEY ("businessId", "sourceExternalTransactionId") REFERENCES "ExternalTransaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_businessId_sourceTransactionId_fkey" FOREIGN KEY ("businessId", "sourceTransactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthEndClose" ADD CONSTRAINT "MonthEndClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
