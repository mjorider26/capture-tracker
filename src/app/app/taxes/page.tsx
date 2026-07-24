import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { TaxesExperience } from "@/components/taxes-experience";
import { getTaxesDashboard } from "@/lib/data/taxes";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };
async function context() {
  try {
    return await requireBusinessContext();
  } catch (e) {
    if (isAccessControlError(e)) notFound();
    throw e;
  }
}
export default async function Taxes() {
  const c = await context();
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={c.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <TaxesExperience
        data={await getTaxesDashboard(c.business.id)}
        basePath="/app"
      />
    </AppShell>
  );
}
