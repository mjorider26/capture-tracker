import { notFound } from "next/navigation";

import { AccountingNav } from "@/components/accounting-nav";
import { AppShell } from "@/components/app-shell";
import { ReconciliationList } from "@/components/reconciliation-list";
import { PageHeader } from "@/components/ui";
import { getReconciliations } from "@/lib/data/reconciliations";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function Reconciliations() {
  let context;
  try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  const records = await getReconciliations(context.business.id);
  return <AppShell mode="app" destination="money" navigationDestination="reconciliation" businessName={context.business.displayName}><AccountingNav basePath="/app" active="reconciliations"/><PageHeader eyebrow="Money" title="Account reconciliation" description="Each active business financial account is shown, including accounts that have not started a reconciliation."/><ReconciliationList items={records}/></AppShell>;
}
