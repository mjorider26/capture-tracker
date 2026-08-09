-- V2.2 additive operational posting links and safe AR/AP provisioning.
-- No financial event, balance, journal, invoice, or bill is fabricated here.

ALTER TYPE "JournalEntrySourceType" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUE';
ALTER TYPE "JournalEntrySourceType" ADD VALUE IF NOT EXISTS 'INVOICE_PAYMENT';
ALTER TYPE "JournalEntrySourceType" ADD VALUE IF NOT EXISTS 'BILL_APPROVAL';
ALTER TYPE "JournalEntrySourceType" ADD VALUE IF NOT EXISTS 'BILL_PAYMENT';

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issuedJournalEntryId" TEXT;
ALTER TABLE "InvoicePayment" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "approvalJournalEntryId" TEXT;
ALTER TABLE "BillPayment" ADD COLUMN IF NOT EXISTS "journalEntryId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_businessId_issuedJournalEntryId_key" ON "Invoice"("businessId", "issuedJournalEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "InvoicePayment_businessId_journalEntryId_key" ON "InvoicePayment"("businessId", "journalEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Bill_businessId_approvalJournalEntryId_key" ON "Bill"("businessId", "approvalJournalEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillPayment_businessId_journalEntryId_key" ON "BillPayment"("businessId", "journalEntryId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_issuedJournalEntryId_fkey"
  FOREIGN KEY ("businessId", "issuedJournalEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_businessId_journalEntryId_fkey"
  FOREIGN KEY ("businessId", "journalEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_businessId_approvalJournalEntryId_fkey"
  FOREIGN KEY ("businessId", "approvalJournalEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT;
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_businessId_journalEntryId_fkey"
  FOREIGN KEY ("businessId", "journalEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT;

-- A familiar numeric code may already belong to a user account.  In that case
-- create the required system account with a deterministic system code rather
-- than rewriting or merging the user record.
INSERT INTO "LedgerAccount" (
  "id", "businessId", "code", "name", "type", "subtype", "normalBalance", "isSystem", "isActive", "createdAt", "updatedAt", "version"
)
SELECT
  'workspace-' || b."id" || '-1100', b."id",
  CASE WHEN EXISTS (SELECT 1 FROM "LedgerAccount" c WHERE c."businessId" = b."id" AND c."code" = '1100') THEN 'SYS-AR' ELSE '1100' END,
  'Accounts Receivable', 'ASSET', 'ACCOUNTS_RECEIVABLE', 'DEBIT', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "LedgerAccount" a
  WHERE a."businessId" = b."id" AND a."isSystem" = TRUE AND a."subtype" = 'ACCOUNTS_RECEIVABLE'
)
ON CONFLICT DO NOTHING;

INSERT INTO "LedgerAccount" (
  "id", "businessId", "code", "name", "type", "subtype", "normalBalance", "isSystem", "isActive", "createdAt", "updatedAt", "version"
)
SELECT
  'workspace-' || b."id" || '-2000', b."id",
  CASE WHEN EXISTS (SELECT 1 FROM "LedgerAccount" c WHERE c."businessId" = b."id" AND c."code" = '2000') THEN 'SYS-AP' ELSE '2000' END,
  'Accounts Payable', 'LIABILITY', 'ACCOUNTS_PAYABLE', 'CREDIT', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1
FROM "Business" b
WHERE NOT EXISTS (
  SELECT 1 FROM "LedgerAccount" a
  WHERE a."businessId" = b."id" AND a."isSystem" = TRUE AND a."subtype" = 'ACCOUNTS_PAYABLE'
)
ON CONFLICT DO NOTHING;

-- Prevent duplicate system AR/AP creation while deliberately permitting an
-- owner-created account with the same subtype to remain untouched.
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerAccount_one_system_ar_per_business"
  ON "LedgerAccount"("businessId", "subtype")
  WHERE "isSystem" = TRUE AND "subtype" = 'ACCOUNTS_RECEIVABLE';
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerAccount_one_system_ap_per_business"
  ON "LedgerAccount"("businessId", "subtype")
  WHERE "isSystem" = TRUE AND "subtype" = 'ACCOUNTS_PAYABLE';
