import { notFound } from "next/navigation";

import { AppShell, isDestination } from "@/components/app-shell";
import { TodayExperience } from "@/components/today-experience";
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
}: {
  params: Promise<{ destination: string }>;
}) {
  const { destination } = await params;
  if (!isDestination(destination)) notFound();
  const context = await getApplicationContext();
  const content =
    destination === "today" ? (
      <TodayExperience
        dashboard={await getTodayDashboard(context.business.id)}
      />
    ) : (
      <Placeholder destination={destination} />
    );
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
