CREATE TYPE "TransactionImportStatus" AS ENUM ('UPLOADED', 'MAPPING_REQUIRED', 'PREVIEW_READY', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ExternalTransactionStatus" AS ENUM ('IMPORTED', 'NORMALIZED', 'NEEDS_REVIEW', 'SUGGESTED', 'READY_TO_POST', 'POSTED', 'IGNORED', 'DUPLICATE', 'POSSIBLE_DUPLICATE', 'INVALID');
CREATE TYPE "MerchantCategoryRuleMode" AS ENUM ('SUGGEST_ONLY', 'AUTO_CLASSIFY');

CREATE TABLE "TransactionImportProfile" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceSignature" TEXT NOT NULL,
  "mappingJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "TransactionImportProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionImport" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "profileId" TEXT,
  "sourceFilename" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "mappingJson" JSONB NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "possibleDuplicateCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "status" "TransactionImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "TransactionImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalTransaction" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "transactionImportId" TEXT NOT NULL,
  "financialAccountId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "postedDate" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "normalizedMerchant" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "direction" "TransactionDirection" NOT NULL,
  "externalTransactionId" TEXT,
  "sourceReference" TEXT,
  "fingerprint" TEXT NOT NULL,
  "bankCategory" TEXT,
  "status" "ExternalTransactionStatus" NOT NULL DEFAULT 'IMPORTED',
  "suggestionReason" TEXT,
  "suggestedLedgerAccountId" TEXT,
  "reviewLedgerAccountId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "postedTransactionId" TEXT,
  "duplicateOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "ExternalTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantCategoryRule" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "financialAccountId" TEXT,
  "normalizedMerchant" TEXT NOT NULL,
  "direction" "TransactionDirection",
  "ledgerAccountId" TEXT NOT NULL,
  "mode" "MerchantCategoryRuleMode" NOT NULL DEFAULT 'SUGGEST_ONLY',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "applicationCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MerchantCategoryRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransactionImport_businessId_id_key" ON "TransactionImport"("businessId", "id");
CREATE INDEX "TransactionImport_businessId_status_createdAt_idx" ON "TransactionImport"("businessId", "status", "createdAt");
CREATE INDEX "TransactionImport_businessId_financialAccountId_createdAt_idx" ON "TransactionImport"("businessId", "financialAccountId", "createdAt");
CREATE UNIQUE INDEX "TransactionImportProfile_businessId_id_key" ON "TransactionImportProfile"("businessId", "id");
CREATE UNIQUE INDEX "TransactionImportProfile_businessId_financialAccountId_sourceSignature_key" ON "TransactionImportProfile"("businessId", "financialAccountId", "sourceSignature");
CREATE INDEX "TransactionImportProfile_businessId_financialAccountId_isActive_idx" ON "TransactionImportProfile"("businessId", "financialAccountId", "isActive");
CREATE UNIQUE INDEX "ExternalTransaction_businessId_id_key" ON "ExternalTransaction"("businessId", "id");
CREATE UNIQUE INDEX "ExternalTransaction_businessId_transactionImportId_rowNumber_key" ON "ExternalTransaction"("businessId", "transactionImportId", "rowNumber");
CREATE UNIQUE INDEX "ExternalTransaction_businessId_postedTransactionId_key" ON "ExternalTransaction"("businessId", "postedTransactionId");
CREATE INDEX "ExternalTransaction_businessId_financialAccountId_externalTransactionId_idx" ON "ExternalTransaction"("businessId", "financialAccountId", "externalTransactionId");
CREATE INDEX "ExternalTransaction_businessId_financialAccountId_fingerprint_idx" ON "ExternalTransaction"("businessId", "financialAccountId", "fingerprint");
CREATE INDEX "ExternalTransaction_businessId_status_transactionDate_idx" ON "ExternalTransaction"("businessId", "status", "transactionDate");
CREATE UNIQUE INDEX "MerchantCategoryRule_businessId_financialAccountId_normalizedMerchant_direction_key" ON "MerchantCategoryRule"("businessId", "financialAccountId", "normalizedMerchant", "direction");
CREATE INDEX "MerchantCategoryRule_businessId_isActive_normalizedMerchant_idx" ON "MerchantCategoryRule"("businessId", "isActive", "normalizedMerchant");

ALTER TABLE "TransactionImportProfile" ADD CONSTRAINT "TransactionImportProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionImportProfile" ADD CONSTRAINT "TransactionImportProfile_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionImport" ADD CONSTRAINT "TransactionImport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionImport" ADD CONSTRAINT "TransactionImport_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionImport" ADD CONSTRAINT "TransactionImport_businessId_profileId_fkey" FOREIGN KEY ("businessId", "profileId") REFERENCES "TransactionImportProfile"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_transactionImportId_fkey" FOREIGN KEY ("businessId", "transactionImportId") REFERENCES "TransactionImport"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_suggestedLedgerAccountId_fkey" FOREIGN KEY ("businessId", "suggestedLedgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_reviewLedgerAccountId_fkey" FOREIGN KEY ("businessId", "reviewLedgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_postedTransactionId_fkey" FOREIGN KEY ("businessId", "postedTransactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_businessId_duplicateOfId_fkey" FOREIGN KEY ("businessId", "duplicateOfId") REFERENCES "ExternalTransaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantCategoryRule" ADD CONSTRAINT "MerchantCategoryRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantCategoryRule" ADD CONSTRAINT "MerchantCategoryRule_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MerchantCategoryRule" ADD CONSTRAINT "MerchantCategoryRule_businessId_ledgerAccountId_fkey" FOREIGN KEY ("businessId", "ledgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
