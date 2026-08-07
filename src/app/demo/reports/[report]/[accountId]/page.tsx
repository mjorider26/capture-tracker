import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportAccountDetail } from "@/components/report-account-detail";
import { getReportAccountDetail, type ReportKind } from "@/lib/data/reports";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

const valid = new Set<ReportKind>(["profit-and-loss", "balance-sheet", "trial-balance", "cash-activity"]);
export const dynamic = "force-dynamic";
export default async function DemoReportAccountPage({ params, searchParams }: { params: Promise<{ report: string; accountId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) { const { report, accountId } = await params; const context = await resolveLocalDemoContext(); if (!context || !valid.has(report as ReportKind)) notFound(); const detail = await getReportAccountDetail(context.businessId, accountId, report as ReportKind, await searchParams); if (!detail) notFound(); return <AppShell mode="demo" destination="reports" businessName={context.businessName}><ReportAccountDetail detail={detail} basePath="/demo" report={report}/></AppShell>; }
