import { readFileSync } from "node:fs";
for (const [path, terms] of Object.entries({ "prisma/migrations/20260727100000_weekly_review_history/migration.sql": ["WeeklyReviewHistory", "WeeklyReview_completion_integrity"], "src/lib/services/weekly-review.ts": ["completeWeeklyReview", "reopenWeeklyReview", "unresolvedItemCount"] })) { const source = readFileSync(path, "utf8"); for (const term of terms) if (!source.includes(term)) throw new Error(`${path} lacks ${term}`); }
console.log("WEEKLY REVIEW VERIFICATION PASSED");
