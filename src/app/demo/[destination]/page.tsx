import { notFound } from "next/navigation";

import { AppShell, isDestination } from "@/components/app-shell";
import { MoneyExperience } from "@/components/money-experience";
import { TodayExperience } from "@/components/today-experience";
import { Card, PageHeader } from "@/components/ui";
import { getMoneyDashboard } from "@/lib/data/money-dashboard";
import { getTodayDashboard } from "@/lib/data/today-dashboard";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoDestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ destination: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { destination } = await params;
  if (!isDestination(destination)) notFound();
  const context = await resolveLocalDemoContext();
  if (!context) notFound();

  return (
    <AppShell
      mode="demo"
      destination={destination}
      businessName={context.businessName}
    >
      {destination === "today" ? (
        <TodayExperience
          dashboard={await getTodayDashboard(context.businessId)}
        />
      ) : destination === "money" ? (
        <MoneyExperience
          dashboard={await getMoneyDashboard(
            context.businessId,
            await searchParams,
          )}
          basePath="/demo"
        />
      ) : (
        <Placeholder destination={destination} />
      )}
    </AppShell>
  );
}

function Placeholder({ destination }: { destination: string }) {
  const title =
    destination === "ask-ai"
      ? "Ask AI"
      : destination[0].toUpperCase() + destination.slice(1);
  return (
    <Card className="mx-auto max-w-2xl p-7">
      <PageHeader
        eyebrow={title}
        title="Coming in a next phase"
        description="This destination is intentionally not implemented yet."
      />
    </Card>
  );
}
