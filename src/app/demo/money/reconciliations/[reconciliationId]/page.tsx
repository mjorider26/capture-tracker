import { notFound } from "next/navigation";

import { AccountingNav } from "@/components/accounting-nav";
import { AppShell } from "@/components/app-shell";
import { ReconciliationExperience } from "@/components/reconciliation-experience";
import { PageHeader } from "@/components/ui";
import { getReconciliationDetail } from "@/lib/data/reconciliations";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { finalizeDemoReconciliation, matchDemoStatementActivity, rejectDemoStatementCandidate, saveDemoReconciliation, unmatchDemoStatementActivity } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoReconciliationDetail({ params }: { params: Promise<{ reconciliationId: string }> }) {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const detail = await getReconciliationDetail(context.businessId, (await params).reconciliationId);
  if (!detail) notFound();
  return (
    <AppShell mode="demo" destination="money" navigationDestination="reconciliation" businessName={context.businessName}>
      <AccountingNav basePath="/demo" active="reconciliations" />
      <PageHeader eyebrow="Reconciliation evidence" title={detail.accountName} description={`Statement period ${new Date(detail.statementStartDate).toLocaleDateString()} to ${new Date(detail.statementEndDate).toLocaleDateString()}.`} />
      <ReconciliationExperience detail={detail} saveAction={saveDemoReconciliation} finalizeAction={finalizeDemoReconciliation} matchAction={matchDemoStatementActivity} rejectAction={rejectDemoStatementCandidate} unmatchAction={unmatchDemoStatementActivity} />
    </AppShell>
  );
}
