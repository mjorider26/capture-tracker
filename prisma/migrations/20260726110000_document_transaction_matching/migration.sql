CREATE TYPE "DocumentMatchRunStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'STALE', 'DISMISSED');
CREATE TYPE "DocumentMatchSuggestionStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED', 'DISMISSED', 'STALE');
CREATE TYPE "DocumentMatchHistoryAction" AS ENUM ('GENERATED', 'APPROVED', 'REJECTED', 'DISMISSED', 'STALE', 'LINKED', 'LINK_FAILED');

CREATE TABLE "DocumentMatchRun" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "extractionAttemptId" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "sourceObjectVersion" TEXT,
  "evidenceFingerprint" TEXT NOT NULL,
  "matchingEngineId" TEXT NOT NULL,
  "matchingEngineVersion" TEXT NOT NULL,
  "status" "DocumentMatchRunStatus" NOT NULL DEFAULT 'PROCESSING',
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentMatchRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentMatchRun_businessId_id_key" UNIQUE ("businessId", "id")
);
CREATE TABLE "DocumentMatchSuggestion" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "reasonCodes" JSONB NOT NULL,
  "rank" INTEGER NOT NULL,
  "status" "DocumentMatchSuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
  "transactionAmount" DECIMAL(18,2) NOT NULL,
  "transactionPostedAt" TIMESTAMP(3) NOT NULL,
  "transactionVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "DocumentMatchSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentMatchSuggestion_businessId_id_key" UNIQUE ("businessId", "id"),
  CONSTRAINT "DocumentMatchSuggestion_businessId_runId_transactionId_key" UNIQUE ("businessId", "runId", "transactionId")
);
CREATE TABLE "DocumentMatchHistory" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "suggestionId" TEXT,
  "action" "DocumentMatchHistoryAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentMatchHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentMatchHistory_businessId_id_key" UNIQUE ("businessId", "id")
);

ALTER TABLE "DocumentMatchRun" ADD CONSTRAINT "DocumentMatchRun_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchRun" ADD CONSTRAINT "DocumentMatchRun_document" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchRun" ADD CONSTRAINT "DocumentMatchRun_extraction" FOREIGN KEY ("businessId", "extractionAttemptId") REFERENCES "DocumentExtractionAttempt"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchRun" ADD CONSTRAINT "DocumentMatchRun_requester" FOREIGN KEY ("businessId", "requestedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_run" FOREIGN KEY ("businessId", "runId") REFERENCES "DocumentMatchRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_transaction" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchHistory" ADD CONSTRAINT "DocumentMatchHistory_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchHistory" ADD CONSTRAINT "DocumentMatchHistory_run" FOREIGN KEY ("businessId", "runId") REFERENCES "DocumentMatchRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchHistory" ADD CONSTRAINT "DocumentMatchHistory_suggestion" FOREIGN KEY ("businessId", "suggestionId") REFERENCES "DocumentMatchSuggestion"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentMatchHistory" ADD CONSTRAINT "DocumentMatchHistory_actor" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DocumentMatchRun_active_evidence" ON "DocumentMatchRun"("businessId", "documentId", "evidenceFingerprint") WHERE "status" IN ('PROCESSING', 'COMPLETED');
CREATE INDEX "DocumentMatchRun_businessId_documentId_requestedAt_idx" ON "DocumentMatchRun"("businessId", "documentId", "requestedAt");
CREATE INDEX "DocumentMatchRun_businessId_extractionAttemptId_idx" ON "DocumentMatchRun"("businessId", "extractionAttemptId");
CREATE INDEX "DocumentMatchSuggestion_businessId_transactionId_createdAt_idx" ON "DocumentMatchSuggestion"("businessId", "transactionId", "createdAt");
CREATE INDEX "DocumentMatchHistory_businessId_runId_createdAt_idx" ON "DocumentMatchHistory"("businessId", "runId", "createdAt");
CREATE INDEX "DocumentMatchHistory_businessId_suggestionId_createdAt_idx" ON "DocumentMatchHistory"("businessId", "suggestionId", "createdAt");
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_score_range" CHECK ("score" >= 0 AND "score" <= 100);
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_rank_positive" CHECK ("rank" > 0);
ALTER TABLE "DocumentMatchSuggestion" ADD CONSTRAINT "DocumentMatchSuggestion_decision_integrity" CHECK (("status" = 'SUGGESTED' AND "decidedAt" IS NULL) OR ("status" IN ('APPROVED', 'REJECTED', 'DISMISSED', 'STALE') AND "decidedAt" IS NOT NULL));
