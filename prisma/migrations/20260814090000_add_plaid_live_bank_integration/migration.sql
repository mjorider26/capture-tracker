-- Additive Plaid connectivity. Existing financial accounts remain manual by default.
CREATE TYPE "BankFeedMethod" AS ENUM ('MANUAL', 'PLAID');
CREATE TYPE "BankProviderTransactionState" AS ENUM ('ACTIVE', 'REMOVED', 'REPLACED');
CREATE TYPE "BankWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "FinancialAccount" ADD COLUMN "bankFeedMethod" "BankFeedMethod" NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "BankConnection"
  ADD COLUMN "institutionId" VARCHAR(191),
  ADD COLUMN "encryptedAccessToken" TEXT,
  ADD COLUMN "accessTokenKeyVersion" INTEGER,
  ADD COLUMN "connectedByUserId" TEXT,
  ADD COLUMN "disconnectedAt" TIMESTAMP(3);

ALTER TABLE "ConnectedFinancialAccount" ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BankSyncRun" ADD COLUMN "removedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BankProviderTransaction"
  ADD COLUMN "pendingTransactionRef" VARCHAR(191),
  ADD COLUMN "state" "BankProviderTransactionState" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "providerContentHash" VARCHAR(64),
  ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "replacedByRef" VARCHAR(191);

CREATE TABLE "BankWebhookEvent" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "bankConnectionId" TEXT NOT NULL,
  "providerId" VARCHAR(64) NOT NULL,
  "requestBodySha256" VARCHAR(64) NOT NULL,
  "verificationKeyId" VARCHAR(191) NOT NULL,
  "webhookType" VARCHAR(100) NOT NULL,
  "webhookCode" VARCHAR(100) NOT NULL,
  "status" "BankWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "errorCode" VARCHAR(100),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "BankWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankConnection_providerId_providerConnectionRef_idx" ON "BankConnection"("providerId", "providerConnectionRef");
CREATE INDEX "BankProviderTransaction_businessId_bankConnectionId_pendingTransactionRef_idx" ON "BankProviderTransaction"("businessId", "bankConnectionId", "pendingTransactionRef");
CREATE UNIQUE INDEX "BankWebhookEvent_providerId_requestBodySha256_key" ON "BankWebhookEvent"("providerId", "requestBodySha256");
CREATE INDEX "BankWebhookEvent_businessId_receivedAt_idx" ON "BankWebhookEvent"("businessId", "receivedAt");
CREATE INDEX "BankWebhookEvent_bankConnectionId_status_idx" ON "BankWebhookEvent"("bankConnectionId", "status");

ALTER TABLE "BankWebhookEvent" ADD CONSTRAINT "BankWebhookEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankWebhookEvent" ADD CONSTRAINT "BankWebhookEvent_bankConnectionId_fkey" FOREIGN KEY ("bankConnectionId") REFERENCES "BankConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
