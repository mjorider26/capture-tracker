CREATE TYPE "OwnerTransferDirection" AS ENUM ('COMPANY_TO_OWNER', 'OWNER_TO_COMPANY');
CREATE TYPE "OwnerTransferClassification" AS ENUM ('UNRESOLVED', 'PAYROLL_NET_SALARY', 'SHAREHOLDER_DISTRIBUTION', 'REIMBURSEMENT', 'SHAREHOLDER_LOAN_REPAYMENT', 'OWNER_CONTRIBUTION', 'SHAREHOLDER_LOAN', 'OTHER');
CREATE TYPE "OwnerTransferStatus" AS ENUM ('PENDING_REVIEW', 'CLASSIFIED', 'MATCHED', 'VOIDED');

CREATE TABLE "OwnerMoneyTransfer" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "externalTransactionId" TEXT NOT NULL,
  "direction" "OwnerTransferDirection" NOT NULL,
  "classification" "OwnerTransferClassification" NOT NULL DEFAULT 'UNRESOLVED',
  "status" "OwnerTransferStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "notes" TEXT,
  "classifiedAt" TIMESTAMP(3),
  "classifiedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OwnerMoneyTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OwnerMoneyTransfer_businessId_id_key" ON "OwnerMoneyTransfer"("businessId", "id");
CREATE UNIQUE INDEX "OwnerMoneyTransfer_businessId_externalTransactionId_key" ON "OwnerMoneyTransfer"("businessId", "externalTransactionId");
CREATE INDEX "OwnerMoneyTransfer_businessId_status_direction_idx" ON "OwnerMoneyTransfer"("businessId", "status", "direction");

ALTER TABLE "OwnerMoneyTransfer" ADD CONSTRAINT "OwnerMoneyTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerMoneyTransfer" ADD CONSTRAINT "OwnerMoneyTransfer_businessId_externalTransactionId_fkey" FOREIGN KEY ("businessId", "externalTransactionId") REFERENCES "ExternalTransaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
