-- Replay protection is scoped to the signed delivery, not just the JSON body. Plaid can
-- legitimately deliver the same event shape again for a later transaction update.
ALTER TABLE "BankWebhookEvent" ADD COLUMN "verificationSignatureSha256" VARCHAR(64);

UPDATE "BankWebhookEvent"
SET "verificationSignatureSha256" = encode(sha256(("providerId" || ':' || "requestBodySha256" || ':' || "id")::bytea), 'hex')
WHERE "verificationSignatureSha256" IS NULL;

ALTER TABLE "BankWebhookEvent" ALTER COLUMN "verificationSignatureSha256" SET NOT NULL;
DROP INDEX "BankWebhookEvent_providerId_requestBodySha256_key";
CREATE UNIQUE INDEX "BankWebhookEvent_providerId_verificationSignatureSha256_key"
  ON "BankWebhookEvent"("providerId", "verificationSignatureSha256");
