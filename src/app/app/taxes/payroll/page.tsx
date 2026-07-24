import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PayrollExperience } from "@/components/taxes-experience";
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
export default async function PayrollPage() {
  const context = await getContext();
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={context.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <PayrollExperience data={await getTaxesDashboard(context.business.id)} />
    </AppShell>
  );
}
