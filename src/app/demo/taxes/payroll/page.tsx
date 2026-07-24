import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PayrollExperience } from "@/components/taxes-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxesDashboard } from "@/lib/data/taxes";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoPayrollPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  return (
    <AppShell
      mode="demo"
      destination="taxes"
      businessName={context.businessName}
    >
      <TaxesNav basePath="/demo" />
      <PayrollExperience data={await getTaxesDashboard(context.businessId)} />
    </AppShell>
  );
}
