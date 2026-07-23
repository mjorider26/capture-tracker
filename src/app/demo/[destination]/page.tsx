import { notFound } from "next/navigation";

import { AppShell, isDestination } from "@/components/app-shell";
import { MoneyExperience } from "@/components/money-experience";
import { TodayExperience } from "@/components/today-experience";
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
    <section className="mx-auto max-w-2xl rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#dce5f0]">
      <p className="text-sm font-semibold text-[#155eef]">{title}</p>
      <h1 className="mt-2 text-2xl font-bold">Coming in a next phase</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#63738a]">
        This destination is intentionally not implemented yet.
      </p>
    </section>
  );
}
