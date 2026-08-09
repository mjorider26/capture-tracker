import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { YearEndReadinessExperience } from "@/components/year-end-readiness-experience";
import { prisma } from "@/lib/prisma";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getYearEndReadiness } from "@/lib/services/year-end";

export const dynamic = "force-dynamic"; export const revalidate = 0; export const metadata = { robots: { index: false, follow: false } };
export default async function YearEndPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) { let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } const params = await searchParams; const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : new Date().getUTCFullYear(); const data = await getYearEndReadiness(prisma, context.business.id, year); return <AppShell mode="app" destination="taxes" businessName={context.business.displayName}><TaxesNav basePath="/app" /><YearEndReadinessExperience {...data} /></AppShell>; }
