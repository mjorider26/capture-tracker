import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReportAccountDetail } from "@/components/report-account-detail";
import { getReportAccountDetail, type ReportKind } from "@/lib/data/reports";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

const valid = new Set<ReportKind>(["profit-and-loss", "balance-sheet", "trial-balance", "cash-activity"]);
export const dynamic = "force-dynamic";
export default async function ReportAccountPage({ params, searchParams }: { params: Promise<{ report: string; accountId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) { const { report, accountId } = await params; if (!valid.has(report as ReportKind)) notFound(); let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } const detail = await getReportAccountDetail(context.business.id, accountId, report as ReportKind, await searchParams); if (!detail) notFound(); return <AppShell mode="app" destination="reports" businessName={context.business.displayName}><ReportAccountDetail detail={detail} basePath="/app" report={report}/></AppShell>; }
