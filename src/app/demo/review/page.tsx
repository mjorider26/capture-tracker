import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { WeeklyReviewExperience } from "@/components/weekly-review-experience";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { getBooksCurrentThrough } from "@/lib/services/books-current-through";
import { getWeeklyReview } from "@/lib/services/weekly-review";

import { completeDemoWeeklyReview, reopenDemoWeeklyReview, startDemoWeeklyReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function DemoReviewPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const [data, current] = await Promise.all([getWeeklyReview(context.businessId), getBooksCurrentThrough(prisma, context.businessId)]);
  return <AppShell mode="demo" destination="review" businessName={context.businessName}><WeeklyReviewExperience review={data.review} tasks={data.tasks} booksCurrent={{ date: current.date?.toISOString() ?? null, blocker: current.blockers[0] ? { label: current.blockers[0].label, count: current.blockers[0].count, date: current.blockers[0].date.toISOString() } : null }} basePath="/demo" startAction={startDemoWeeklyReview} completeAction={completeDemoWeeklyReview} reopenAction={reopenDemoWeeklyReview}/></AppShell>;
}
