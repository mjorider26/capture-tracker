CREATE TYPE "WeeklyReviewHistoryAction" AS ENUM ('STARTED', 'SECTION_ACKNOWLEDGED', 'COMPLETED', 'REOPENED');

ALTER TABLE "WeeklyReview" ADD COLUMN "startedByUserId" TEXT;
ALTER TABLE "WeeklyReview" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "WeeklyReview" ADD COLUMN "completedByUserId" TEXT;
ALTER TABLE "WeeklyReview" ADD COLUMN "completionNote" TEXT;
ALTER TABLE "WeeklyReview" ADD COLUMN "unresolvedItemCount" INTEGER;

CREATE TABLE "WeeklyReviewHistory" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "weeklyReviewId" TEXT NOT NULL,
  "action" "WeeklyReviewHistoryAction" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "section" TEXT,
  "unresolvedItemCount" INTEGER,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyReviewHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WeeklyReviewHistory_businessId_id_key" UNIQUE ("businessId", "id")
);

ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_started_by" FOREIGN KEY ("businessId", "startedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_completed_by" FOREIGN KEY ("businessId", "completedByUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyReviewHistory" ADD CONSTRAINT "WeeklyReviewHistory_business" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyReviewHistory" ADD CONSTRAINT "WeeklyReviewHistory_review" FOREIGN KEY ("businessId", "weeklyReviewId") REFERENCES "WeeklyReview"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyReviewHistory" ADD CONSTRAINT "WeeklyReviewHistory_actor" FOREIGN KEY ("businessId", "actorUserId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "WeeklyReviewHistory_businessId_weeklyReviewId_createdAt_idx" ON "WeeklyReviewHistory"("businessId", "weeklyReviewId", "createdAt");
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_completion_integrity" CHECK (("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL AND "unresolvedItemCount" IS NOT NULL AND "unresolvedItemCount" >= 0) OR ("status" <> 'COMPLETED' AND "completedAt" IS NULL AND "completedByUserId" IS NULL AND "completionNote" IS NULL AND "unresolvedItemCount" IS NULL));
