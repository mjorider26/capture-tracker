import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxesDashboard } from "@/lib/data/taxes";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoEstimatesPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const data = await getTaxesDashboard(context.businessId);
  return (
    <AppShell
      mode="demo"
      destination="taxes"
      businessName={context.businessName}
    >
      <TaxesNav basePath="/demo" />
      <h1 className="text-3xl font-bold">Quarterly estimates</h1>
      {data.estimates.map((estimate) => (
        <Link
          className="ui-card mt-3 block min-h-11 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
          href={`/demo/taxes/estimates/${estimate.id}`}
          key={estimate.id}
        >
          Q{estimate.quarter} {estimate.taxYear} · ${estimate.remaining}{" "}
          remaining
        </Link>
      ))}
    </AppShell>
  );
}
