import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OperationalReports } from "@/components/operational-reports";
import { getOperationalReport } from "@/lib/data/operational-reports";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
export const dynamic = "force-dynamic";
export default async function OperationsReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } return <AppShell mode="app" destination="reports" businessName={context.business.displayName}><OperationalReports data={await getOperationalReport(context.business.id, await searchParams)}/></AppShell>; }
