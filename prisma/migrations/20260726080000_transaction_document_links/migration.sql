CREATE TYPE "TransactionDocumentLinkAction" AS ENUM ('LINKED', 'UNLINKED');
ALTER TABLE "TransactionDocument" DROP CONSTRAINT "TransactionDocument_pkey";
ALTER TABLE "TransactionDocument" ADD COLUMN "id" TEXT;
UPDATE "TransactionDocument" SET "id" = concat('legacy-', "businessId", '-', "transactionId", '-', "documentId") WHERE "id" IS NULL;
ALTER TABLE "TransactionDocument" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "TransactionDocument" ADD COLUMN "linkedByUserId" TEXT;
UPDATE "TransactionDocument" AS link SET "linkedByUserId" = document."uploadedByMembershipId" FROM "Document" AS document WHERE document."businessId" = link."businessId" AND document."id" = link."documentId" AND link."linkedByUserId" IS NULL;
ALTER TABLE "TransactionDocument" ALTER COLUMN "linkedByUserId" SET NOT NULL;
ALTER TABLE "TransactionDocument" ADD COLUMN "unlinkedAt" TIMESTAMP(3);
ALTER TABLE "TransactionDocument" ADD COLUMN "unlinkedByUserId" TEXT;
ALTER TABLE "TransactionDocument" ADD COLUMN "unlinkReason" TEXT;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("id");
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_businessId_id_key" UNIQUE ("businessId", "id");
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_linkedBy" FOREIGN KEY ("businessId", "linkedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_unlinkedBy" FOREIGN KEY ("businessId", "unlinkedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "TransactionDocument_active_pair" ON "TransactionDocument"("businessId", "transactionId", "documentId") WHERE "unlinkedAt" IS NULL;
CREATE INDEX "TransactionDocument_businessId_transactionId_attachedAt_idx" ON "TransactionDocument"("businessId", "transactionId", "attachedAt");
CREATE INDEX "TransactionDocument_businessId_documentId_attachedAt_idx" ON "TransactionDocument"("businessId", "documentId", "attachedAt");
CREATE TABLE "TransactionDocumentHistory" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "transactionDocumentId" TEXT NOT NULL,
  "action" "TransactionDocumentLinkAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionDocumentHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TransactionDocumentHistory" ADD CONSTRAINT "TransactionDocumentHistory_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionDocumentHistory" ADD CONSTRAINT "TransactionDocumentHistory_link" FOREIGN KEY ("businessId", "transactionDocumentId") REFERENCES "TransactionDocument"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionDocumentHistory" ADD CONSTRAINT "TransactionDocumentHistory_actor" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TransactionDocumentHistory_businessId_transactionDocumentId_createdAt_idx" ON "TransactionDocumentHistory"("businessId", "transactionDocumentId", "createdAt");
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_unlink_integrity" CHECK (("unlinkedAt" IS NULL AND "unlinkedByUserId" IS NULL AND "unlinkReason" IS NULL) OR ("unlinkedAt" IS NOT NULL AND "unlinkedByUserId" IS NOT NULL));
INSERT INTO "TransactionDocumentHistory" ("id", "businessId", "transactionDocumentId", "action", "actorUserId", "createdAt") SELECT concat('migration-linked-', "id"), "businessId", "id", 'LINKED'::"TransactionDocumentLinkAction", "linkedByUserId", "attachedAt" FROM "TransactionDocument";
