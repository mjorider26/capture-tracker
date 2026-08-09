import { notFound } from "next/navigation";

import { AppShell, isDestination } from "@/components/app-shell";
import { MoneyExperience } from "@/components/money-experience";
import { TodayExperience } from "@/components/today-experience";
import { getMoneyDashboard } from "@/lib/data/money-dashboard";
import { getMoneyOperationsSummary } from "@/lib/data/money-operations";
import { getTodayDashboard } from "@/lib/data/today-dashboard";
import { workspaceFailureMetadata } from "@/lib/observability/workspace-failure";
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
  const money =
    destination === "money"
      ? await Promise.all([
          loadMoneyDashboard(context.business.id, await searchParams),
          getMoneyOperationsSummary(context.business.id),
        ])
      : null;
  const content =
    destination === "today" ? (
      <TodayExperience
        dashboard={await loadTodayDashboard(context.business.id)}
        basePath="/app"
      />
    ) : destination === "money" ? (
      <MoneyExperience
        dashboard={money![0]}
        operations={money![1]}
        canManageCpa={context.membership.role === "OWNER"}
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

async function loadTodayDashboard(businessId: string) {
  try {
    return await getTodayDashboard(businessId);
  } catch (error) {
    console.error(JSON.stringify(workspaceFailureMetadata("today_dashboard", error)));
    throw error;
  }
}

async function loadMoneyDashboard(businessId: string, searchParams: Record<string, string | string[] | undefined>) {
  try {
    return await getMoneyDashboard(businessId, searchParams);
  } catch (error) {
    console.error(JSON.stringify(workspaceFailureMetadata("money_dashboard", error)));
    throw error;
  }
}
