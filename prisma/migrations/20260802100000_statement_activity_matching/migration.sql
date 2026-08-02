CREATE TYPE "StatementActivityStatus" AS ENUM ('UNMATCHED', 'MATCHED');

CREATE TABLE "StatementActivity" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "activityDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "direction" "TransactionDirection" NOT NULL,
  "status" "StatementActivityStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedTransactionId" TEXT,
  "matchedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "StatementActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StatementActivity_businessId_id_key" UNIQUE ("businessId", "id"),
  CONSTRAINT "StatementActivity_businessId_matchedTransactionId_key" UNIQUE ("businessId", "matchedTransactionId")
);

CREATE TABLE "StatementActivityCandidateDecision" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "statementActivityId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "activityVersion" INTEGER NOT NULL,
  "transactionVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REJECTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatementActivityCandidateDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StatementActivityCandidateDecision_businessId_statementActivityId_transactionId_activityVersion_transactionVersion_key" UNIQUE ("businessId", "statementActivityId", "transactionId", "activityVersion", "transactionVersion")
);

CREATE INDEX "StatementActivity_businessId_reconciliationId_status_idx" ON "StatementActivity"("businessId", "reconciliationId", "status");
CREATE INDEX "StatementActivity_businessId_activityDate_idx" ON "StatementActivity"("businessId", "activityDate");
CREATE INDEX "StatementActivityCandidateDecision_businessId_statementActivityId_idx" ON "StatementActivityCandidateDecision"("businessId", "statementActivityId");

ALTER TABLE "StatementActivity" ADD CONSTRAINT "StatementActivity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementActivity" ADD CONSTRAINT "StatementActivity_reconciliation_fkey" FOREIGN KEY ("businessId", "reconciliationId") REFERENCES "Reconciliation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementActivity" ADD CONSTRAINT "StatementActivity_transaction_fkey" FOREIGN KEY ("businessId", "matchedTransactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementActivityCandidateDecision" ADD CONSTRAINT "StatementActivityCandidateDecision_business_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementActivityCandidateDecision" ADD CONSTRAINT "StatementActivityCandidateDecision_activity_fkey" FOREIGN KEY ("businessId", "statementActivityId") REFERENCES "StatementActivity"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatementActivityCandidateDecision" ADD CONSTRAINT "StatementActivityCandidateDecision_transaction_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatementActivity" ADD CONSTRAINT "statement_activity_match_integrity" CHECK (("status" = 'MATCHED' AND "matchedTransactionId" IS NOT NULL AND "matchedAt" IS NOT NULL) OR ("status" = 'UNMATCHED' AND "matchedTransactionId" IS NULL AND "matchedAt" IS NULL));
