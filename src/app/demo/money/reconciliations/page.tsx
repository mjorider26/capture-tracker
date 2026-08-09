import { notFound } from "next/navigation";

import { AccountingNav } from "@/components/accounting-nav";
import { AppShell } from "@/components/app-shell";
import { ReconciliationList } from "@/components/reconciliation-list";
import { PageHeader } from "@/components/ui";
import { getReconciliations } from "@/lib/data/reconciliations";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoReconciliations() { const context = await resolveLocalDemoContext(); if (!context) notFound(); const records = await getReconciliations(context.businessId); return <AppShell mode="demo" destination="money" navigationDestination="reconciliation" businessName={context.businessName}><AccountingNav basePath="/demo" active="reconciliations"/><PageHeader eyebrow="Money" title="Account reconciliation" description="Every eligible demo financial account is visible."/><ReconciliationList items={records.filter((record) => Boolean(record.id))} basePath="/demo"/></AppShell>; }
