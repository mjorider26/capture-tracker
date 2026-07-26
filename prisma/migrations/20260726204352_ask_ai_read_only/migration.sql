-- CreateEnum
CREATE TYPE "AskAiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM_EVENT');

-- CreateEnum
CREATE TYPE "AskAiRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AskAiEventAction" AS ENUM ('QUESTION_SUBMITTED', 'CONTEXT_PREPARED', 'ADAPTER_INVOKED', 'ANSWER_COMPLETED', 'ANSWER_FAILED', 'ANSWER_BLOCKED', 'ANSWER_REFRESHED', 'FEEDBACK_RECORDED');

-- DropIndex
DROP INDEX "TransactionDocument_businessId_documentId_idx";

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AskAiConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Ask AI conversation',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AskAiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiMessage" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "role" "AskAiMessageRole" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(96) NOT NULL,
    "adapterId" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "status" "AskAiRunStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "evidenceAsOf" TIMESTAMP(3),
    "failureCode" TEXT,
    "responseVersion" TEXT NOT NULL DEFAULT 'v1',

    CONSTRAINT "AskAiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiEvidence" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "alias" VARCHAR(64) NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceId" VARCHAR(128),
    "displayLabel" VARCHAR(300) NOT NULL,
    "route" VARCHAR(300),
    "sourceAsOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiFeedback" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "rating" VARCHAR(24) NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "AskAiEventAction" NOT NULL,
    "detail" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AskAiEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AskAiConversation_businessId_updatedAt_idx" ON "AskAiConversation"("businessId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiConversation_businessId_id_key" ON "AskAiConversation"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiMessage_runId_key" ON "AskAiMessage"("runId");

-- CreateIndex
CREATE INDEX "AskAiMessage_businessId_conversationId_createdAt_idx" ON "AskAiMessage"("businessId", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiMessage_businessId_id_key" ON "AskAiMessage"("businessId", "id");

-- CreateIndex
CREATE INDEX "AskAiRun_businessId_status_requestedAt_idx" ON "AskAiRun"("businessId", "status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiRun_businessId_id_key" ON "AskAiRun"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiRun_businessId_userMessageId_key" ON "AskAiRun"("businessId", "userMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiRun_businessId_conversationId_idempotencyKey_key" ON "AskAiRun"("businessId", "conversationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AskAiEvidence_businessId_runId_idx" ON "AskAiEvidence"("businessId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiEvidence_businessId_runId_alias_key" ON "AskAiEvidence"("businessId", "runId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiFeedback_businessId_runId_actorUserId_key" ON "AskAiFeedback"("businessId", "runId", "actorUserId");

-- CreateIndex
CREATE INDEX "AskAiEvent_businessId_runId_createdAt_idx" ON "AskAiEvent"("businessId", "runId", "createdAt");

-- RenameForeignKey
ALTER TABLE "DocumentExtractionAttempt" RENAME CONSTRAINT "DocumentExtractionAttempt_business" TO "DocumentExtractionAttempt_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionAttempt" RENAME CONSTRAINT "DocumentExtractionAttempt_document" TO "DocumentExtractionAttempt_businessId_documentId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionAttempt" RENAME CONSTRAINT "DocumentExtractionAttempt_requester" TO "DocumentExtractionAttempt_businessId_requestedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionCandidate" RENAME CONSTRAINT "DocumentExtractionCandidate_attempt" TO "DocumentExtractionCandidate_businessId_extractionAttemptId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionCandidate" RENAME CONSTRAINT "DocumentExtractionCandidate_reviewer" TO "DocumentExtractionCandidate_businessId_reviewedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionHistory" RENAME CONSTRAINT "DocumentExtractionHistory_actor" TO "DocumentExtractionHistory_businessId_actorUserId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionHistory" RENAME CONSTRAINT "DocumentExtractionHistory_attempt" TO "DocumentExtractionHistory_businessId_extractionAttemptId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionHistory" RENAME CONSTRAINT "DocumentExtractionHistory_business" TO "DocumentExtractionHistory_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentExtractionHistory" RENAME CONSTRAINT "DocumentExtractionHistory_candidate" TO "DocumentExtractionHistory_businessId_candidateId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchHistory" RENAME CONSTRAINT "DocumentMatchHistory_actor" TO "DocumentMatchHistory_businessId_actorUserId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchHistory" RENAME CONSTRAINT "DocumentMatchHistory_business" TO "DocumentMatchHistory_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchHistory" RENAME CONSTRAINT "DocumentMatchHistory_run" TO "DocumentMatchHistory_businessId_runId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchHistory" RENAME CONSTRAINT "DocumentMatchHistory_suggestion" TO "DocumentMatchHistory_businessId_suggestionId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchRun" RENAME CONSTRAINT "DocumentMatchRun_business" TO "DocumentMatchRun_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchRun" RENAME CONSTRAINT "DocumentMatchRun_document" TO "DocumentMatchRun_businessId_documentId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchRun" RENAME CONSTRAINT "DocumentMatchRun_extraction" TO "DocumentMatchRun_businessId_extractionAttemptId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchRun" RENAME CONSTRAINT "DocumentMatchRun_requester" TO "DocumentMatchRun_businessId_requestedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchSuggestion" RENAME CONSTRAINT "DocumentMatchSuggestion_business" TO "DocumentMatchSuggestion_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchSuggestion" RENAME CONSTRAINT "DocumentMatchSuggestion_run" TO "DocumentMatchSuggestion_businessId_runId_fkey";

-- RenameForeignKey
ALTER TABLE "DocumentMatchSuggestion" RENAME CONSTRAINT "DocumentMatchSuggestion_transaction" TO "DocumentMatchSuggestion_businessId_transactionId_fkey";

-- RenameForeignKey
ALTER TABLE "TransactionDocument" RENAME CONSTRAINT "TransactionDocument_linkedBy" TO "TransactionDocument_businessId_linkedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "TransactionDocument" RENAME CONSTRAINT "TransactionDocument_unlinkedBy" TO "TransactionDocument_businessId_unlinkedByUserId_fkey";

-- RenameForeignKey
ALTER TABLE "TransactionDocumentHistory" RENAME CONSTRAINT "TransactionDocumentHistory_actor" TO "TransactionDocumentHistory_businessId_actorUserId_fkey";

-- RenameForeignKey
ALTER TABLE "TransactionDocumentHistory" RENAME CONSTRAINT "TransactionDocumentHistory_business" TO "TransactionDocumentHistory_businessId_fkey";

-- RenameForeignKey
ALTER TABLE "TransactionDocumentHistory" RENAME CONSTRAINT "TransactionDocumentHistory_link" TO "TransactionDocumentHistory_businessId_transactionDocumentI_fkey";

-- AddForeignKey
ALTER TABLE "AskAiConversation" ADD CONSTRAINT "AskAiConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiConversation" ADD CONSTRAINT "AskAiConversation_businessId_createdByUserId_fkey" FOREIGN KEY ("businessId", "createdByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiMessage" ADD CONSTRAINT "AskAiMessage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiMessage" ADD CONSTRAINT "AskAiMessage_businessId_conversationId_fkey" FOREIGN KEY ("businessId", "conversationId") REFERENCES "AskAiConversation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiMessage" ADD CONSTRAINT "AskAiMessage_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiMessage" ADD CONSTRAINT "AskAiMessage_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AskAiRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiRun" ADD CONSTRAINT "AskAiRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiRun" ADD CONSTRAINT "AskAiRun_businessId_conversationId_fkey" FOREIGN KEY ("businessId", "conversationId") REFERENCES "AskAiConversation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiRun" ADD CONSTRAINT "AskAiRun_businessId_userMessageId_fkey" FOREIGN KEY ("businessId", "userMessageId") REFERENCES "AskAiMessage"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiRun" ADD CONSTRAINT "AskAiRun_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiEvidence" ADD CONSTRAINT "AskAiEvidence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiEvidence" ADD CONSTRAINT "AskAiEvidence_businessId_runId_fkey" FOREIGN KEY ("businessId", "runId") REFERENCES "AskAiRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiFeedback" ADD CONSTRAINT "AskAiFeedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiFeedback" ADD CONSTRAINT "AskAiFeedback_businessId_runId_fkey" FOREIGN KEY ("businessId", "runId") REFERENCES "AskAiRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiFeedback" ADD CONSTRAINT "AskAiFeedback_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiEvent" ADD CONSTRAINT "AskAiEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiEvent" ADD CONSTRAINT "AskAiEvent_businessId_runId_fkey" FOREIGN KEY ("businessId", "runId") REFERENCES "AskAiRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AskAiEvent" ADD CONSTRAINT "AskAiEvent_businessId_actorUserId_fkey" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DocumentExtractionCandidate_businessId_extractionAttemptId_fiel" RENAME TO "DocumentExtractionCandidate_businessId_extractionAttemptId__idx";

-- RenameIndex
ALTER INDEX "DocumentExtractionHistory_businessId_extractionAttemptId_create" RENAME TO "DocumentExtractionHistory_businessId_extractionAttemptId_cr_idx";

-- RenameIndex
ALTER INDEX "TransactionDocumentHistory_businessId_transactionDocumentId_cre" RENAME TO "TransactionDocumentHistory_businessId_transactionDocumentId_idx";
