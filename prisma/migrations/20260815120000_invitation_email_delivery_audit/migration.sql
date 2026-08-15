CREATE TABLE "OperatorInvitationEvent" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "event" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(32),
    "providerMessageId" VARCHAR(200),
    "failureCode" VARCHAR(64),
    "relatedInvitationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorInvitationEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OperatorInvitationEvent_event_check" CHECK ("event" IN (
        'INVITATION_CREATED',
        'INVITATION_EMAIL_SENDING',
        'INVITATION_EMAIL_ACCEPTED',
        'INVITATION_EMAIL_FAILED',
        'INVITATION_REISSUED',
        'INVITATION_REVOKED',
        'INVITATION_EXPIRED'
    ))
);

CREATE INDEX "OperatorInvitationEvent_invitationId_occurredAt_idx"
    ON "OperatorInvitationEvent"("invitationId", "occurredAt");

CREATE INDEX "OperatorInvitationEvent_actorUserId_occurredAt_idx"
    ON "OperatorInvitationEvent"("actorUserId", "occurredAt");

ALTER TABLE "OperatorInvitationEvent"
    ADD CONSTRAINT "OperatorInvitationEvent_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "OperatorInvitation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
