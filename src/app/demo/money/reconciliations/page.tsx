import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AccountingNav } from "@/components/accounting-nav";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getReconciliations } from "@/lib/data/reconciliations";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
export const dynamic = "force-dynamic"; export const revalidate = 0; export const metadata = { robots: { index: false, follow: false } };
export default async function DemoReconciliations() { const context = await resolveLocalDemoContext(); if (!context) notFound(); const records = await getReconciliations(context.businessId); return <AppShell mode="demo" destination="money" businessName={context.businessName}><AccountingNav basePath="/demo" active="reconciliations"/><PageHeader eyebrow="Money" title="Account reconciliation" description="Compare statement-cleared activity with the book balance using exact decimals."/>{records.map((record) => <Link key={record.id} href={`/demo/money/reconciliations/${record.id}`} className="ui-card mb-3 block p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{record.accountName}</h2><p className="mt-1 text-sm text-text-muted">Statement ending {new Date(record.statementEndDate).toLocaleDateString()} · {record.clearedItemCount} cleared items</p></div><StatusBadge tone={record.status === "COMPLETED" ? "success" : "warning"}>{record.status}</StatusBadge></div><p className="money-value mt-4 text-sm font-bold">Difference: ${record.difference}</p></Link>)}</AppShell>; }
