CREATE TYPE "DocumentExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'STALE');
CREATE TYPE "DocumentExtractionFieldType" AS ENUM ('MERCHANT_NAME', 'DOCUMENT_DATE', 'TOTAL_AMOUNT', 'SUBTOTAL_AMOUNT', 'SALES_TAX_AMOUNT', 'TIP_AMOUNT', 'REFERENCE_NUMBER', 'CURRENCY', 'PAYMENT_METHOD', 'MASKED_ACCOUNT_REFERENCE', 'DOCUMENT_DESCRIPTION');
CREATE TYPE "DocumentExtractionReviewState" AS ENUM ('UNREVIEWED', 'ACCEPTED', 'CORRECTED', 'REJECTED');
CREATE TYPE "DocumentExtractionHistoryAction" AS ENUM ('REQUESTED', 'COMPLETED', 'FAILED', 'STALE', 'ACCEPTED', 'CORRECTED', 'REJECTED');

CREATE TABLE "DocumentExtractionAttempt" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "sourceObjectVersion" TEXT,
  "adapterId" TEXT NOT NULL,
  "adapterVersion" TEXT NOT NULL,
  "status" "DocumentExtractionStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "pageCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExtractionAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentExtractionAttempt_businessId_id_key" UNIQUE ("businessId", "id")
);
CREATE TABLE "DocumentExtractionCandidate" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "extractionAttemptId" TEXT NOT NULL,
  "fieldType" "DocumentExtractionFieldType" NOT NULL,
  "originalValue" TEXT NOT NULL,
  "normalizedValue" TEXT,
  "confidence" DECIMAL(5,4) NOT NULL,
  "pageNumber" INTEGER,
  "sourceReference" TEXT,
  "reviewState" "DocumentExtractionReviewState" NOT NULL DEFAULT 'UNREVIEWED',
  "correctedValue" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExtractionCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentExtractionCandidate_businessId_id_key" UNIQUE ("businessId", "id")
);
CREATE TABLE "DocumentExtractionHistory" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "extractionAttemptId" TEXT NOT NULL,
  "candidateId" TEXT,
  "action" "DocumentExtractionHistoryAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExtractionHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentExtractionHistory_businessId_id_key" UNIQUE ("businessId", "id")
);

ALTER TABLE "DocumentExtractionAttempt" ADD CONSTRAINT "DocumentExtractionAttempt_document" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionAttempt" ADD CONSTRAINT "DocumentExtractionAttempt_requester" FOREIGN KEY ("businessId", "requestedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionAttempt" ADD CONSTRAINT "DocumentExtractionAttempt_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionCandidate" ADD CONSTRAINT "DocumentExtractionCandidate_attempt" FOREIGN KEY ("businessId", "extractionAttemptId") REFERENCES "DocumentExtractionAttempt"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionCandidate" ADD CONSTRAINT "DocumentExtractionCandidate_reviewer" FOREIGN KEY ("businessId", "reviewedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionHistory" ADD CONSTRAINT "DocumentExtractionHistory_attempt" FOREIGN KEY ("businessId", "extractionAttemptId") REFERENCES "DocumentExtractionAttempt"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionHistory" ADD CONSTRAINT "DocumentExtractionHistory_candidate" FOREIGN KEY ("businessId", "candidateId") REFERENCES "DocumentExtractionCandidate"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionHistory" ADD CONSTRAINT "DocumentExtractionHistory_actor" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentExtractionHistory" ADD CONSTRAINT "DocumentExtractionHistory_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DocumentExtractionAttempt_active_source" ON "DocumentExtractionAttempt"("businessId", "documentId", "sourceSha256") WHERE "status" IN ('PENDING', 'PROCESSING', 'COMPLETED');
CREATE INDEX "DocumentExtractionAttempt_businessId_documentId_requestedAt_idx" ON "DocumentExtractionAttempt"("businessId", "documentId", "requestedAt");
CREATE INDEX "DocumentExtractionCandidate_businessId_extractionAttemptId_fieldType_idx" ON "DocumentExtractionCandidate"("businessId", "extractionAttemptId", "fieldType");
CREATE INDEX "DocumentExtractionHistory_businessId_extractionAttemptId_createdAt_idx" ON "DocumentExtractionHistory"("businessId", "extractionAttemptId", "createdAt");
ALTER TABLE "DocumentExtractionCandidate" ADD CONSTRAINT "DocumentExtractionCandidate_confidence_range" CHECK ("confidence" >= 0 AND "confidence" <= 1);
ALTER TABLE "DocumentExtractionCandidate" ADD CONSTRAINT "DocumentExtractionCandidate_review_integrity" CHECK (("reviewState" = 'UNREVIEWED' AND "correctedValue" IS NULL AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL) OR ("reviewState" = 'ACCEPTED' AND "correctedValue" IS NULL AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL) OR ("reviewState" = 'CORRECTED' AND "correctedValue" IS NOT NULL AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL) OR ("reviewState" = 'REJECTED' AND "correctedValue" IS NULL AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL));
