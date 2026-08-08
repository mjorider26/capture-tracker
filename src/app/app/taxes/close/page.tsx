import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MonthEndCloseExperience } from "@/components/month-end-close-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { prisma } from "@/lib/prisma";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getCloseReadiness } from "@/lib/services/close";
import { confirmAuthenticatedMonthClose } from "./actions";
export const dynamic = "force-dynamic"; export const revalidate = 0; export const metadata = { robots: { index: false, follow: false } };
export default async function ClosePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) { let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } const params = await searchParams; const now = new Date(); const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; const data = await getCloseReadiness(prisma, context.business.id, month); if (!data) notFound(); const existing = await prisma.monthEndClose.findFirst({ where: { businessId: context.business.id, periodStart: data.start, periodEnd: data.end }, select: { status: true, confirmedAt: true } }); return <AppShell mode="app" destination="taxes" businessName={context.business.displayName}><TaxesNav basePath="/app" /><MonthEndCloseExperience action={confirmAuthenticatedMonthClose} data={{ month, status: existing?.status === "CLOSED" ? "CLOSED" : data.status, checks: data.checks, journalEntryCount: data.journalEntryCount, recordedClose: existing ? { status: existing.status, confirmedAt: existing.confirmedAt?.toISOString() ?? null } : null }} /></AppShell>; }
