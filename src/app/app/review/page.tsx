import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { WeeklyReviewExperience } from "@/components/weekly-review-experience";
import { prisma } from "@/lib/prisma";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getBooksCurrentThrough } from "@/lib/services/books-current-through";
import { getWeeklyReview } from "@/lib/services/weekly-review";

import { completeAuthenticatedWeeklyReview, reopenAuthenticatedWeeklyReview, startAuthenticatedWeeklyReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const context = await getContext();
  const [data, current] = await Promise.all([getWeeklyReview(context.business.id), getBooksCurrentThrough(prisma, context.business.id)]);
  return <AppShell mode="app" destination="review" businessName={context.business.displayName}><WeeklyReviewExperience review={data.review} tasks={data.tasks} booksCurrent={{ date: current.date?.toISOString() ?? null, blocker: current.blockers[0] ? { label: current.blockers[0].label, count: current.blockers[0].count, date: current.blockers[0].date.toISOString() } : null }} basePath="/app" startAction={startAuthenticatedWeeklyReview} completeAction={completeAuthenticatedWeeklyReview} reopenAction={reopenAuthenticatedWeeklyReview} canMutate={context.membership.role === "OWNER"}/></AppShell>;
}

async function getContext() {
  try { return await requireBusinessContext(); }
  catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
}
