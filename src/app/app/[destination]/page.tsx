import { notFound } from "next/navigation";

import { AppShell, isDestination } from "@/components/app-shell";
import { MoneyExperience } from "@/components/money-experience";
import { TodayExperience } from "@/components/today-experience";
import { getMoneyDashboard } from "@/lib/data/money-dashboard";
import { getTodayDashboard } from "@/lib/data/today-dashboard";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function ApplicationDestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ destination: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { destination } = await params;
  if (!isDestination(destination)) notFound();
  const context = await getApplicationContext();
  const content =
    destination === "today" ? (
      <TodayExperience
        dashboard={await getTodayDashboard(context.business.id)}
        basePath="/app"
      />
    ) : destination === "money" ? (
      <MoneyExperience
        dashboard={await getMoneyDashboard(
          context.business.id,
          await searchParams,
        )}
        basePath="/app"
      />
    ) : notFound();
  return (
    <AppShell
      mode="app"
      destination={destination}
      businessName={context.business.displayName}
    >
      {content}
    </AppShell>
  );
}

async function getApplicationContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
