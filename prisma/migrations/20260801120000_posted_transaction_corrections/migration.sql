ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'CORRECTED';

ALTER TABLE "Transaction"
  ADD COLUMN "correctionKey" TEXT,
  ADD COLUMN "correctionReason" TEXT,
  ADD COLUMN "correctionOfId" TEXT,
  ADD COLUMN "correctionReversalJournalId" TEXT;

CREATE UNIQUE INDEX "Transaction_businessId_correctionKey_key" ON "Transaction"("businessId", "correctionKey");
CREATE UNIQUE INDEX "Transaction_businessId_correctionOfId_key" ON "Transaction"("businessId", "correctionOfId");
CREATE UNIQUE INDEX "Transaction_businessId_correctionReversalJournalId_key" ON "Transaction"("businessId", "correctionReversalJournalId");

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_businessId_correctionOfId_fkey"
  FOREIGN KEY ("businessId", "correctionOfId") REFERENCES "Transaction"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_businessId_correctionReversalJournalId_fkey"
  FOREIGN KEY ("businessId", "correctionReversalJournalId") REFERENCES "JournalEntry"("businessId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
