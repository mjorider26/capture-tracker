import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { TaxesExperience } from "@/components/taxes-experience";
import { getTaxesDashboard } from "@/lib/data/taxes";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };
export default async function DemoTaxes() {
  const c = await resolveLocalDemoContext();
  if (!c) notFound();
  return (
    <AppShell mode="demo" destination="taxes" businessName={c.businessName}>
      <TaxesNav basePath="/demo" />
      <TaxesExperience
        data={await getTaxesDashboard(c.businessId)}
        basePath="/demo"
      />
    </AppShell>
  );
}
