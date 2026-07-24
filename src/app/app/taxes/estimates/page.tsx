import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxesDashboard } from "@/lib/data/taxes";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}

export default async function EstimatesPage() {
  const context = await getContext();
  const data = await getTaxesDashboard(context.business.id);
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={context.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <h1 className="text-3xl font-bold">Quarterly estimates</h1>
      {data.estimates.map((estimate) => (
        <Link
          className="ui-card mt-3 block min-h-11 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
          href={`/app/taxes/estimates/${estimate.id}`}
          key={estimate.id}
        >
          Q{estimate.quarter} {estimate.taxYear} - ${estimate.remaining}{" "}
          remaining
        </Link>
      ))}
    </AppShell>
  );
}
