-- A browser-generated key is retained on the source transaction so safe retry
-- handling is database-backed without consuming the user-facing reference field.
ALTER TABLE "Transaction" ADD COLUMN "manualEntryKey" TEXT;
CREATE UNIQUE INDEX "Transaction_businessId_manualEntryKey_key"
  ON "Transaction"("businessId", "manualEntryKey");
