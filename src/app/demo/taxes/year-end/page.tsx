import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TaxesNav } from "@/components/taxes-nav";
import { YearEndReadinessExperience } from "@/components/year-end-readiness-experience";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { getYearEndReadiness } from "@/lib/services/year-end";

export const dynamic = "force-dynamic"; export const revalidate = 0;
export default async function DemoYearEndPage() { const context = await resolveLocalDemoContext(); if (!context) notFound(); const data = await getYearEndReadiness(prisma, context.businessId, new Date().getUTCFullYear()); return <AppShell mode="demo" destination="taxes" businessName={context.businessName}><TaxesNav basePath="/demo" /><YearEndReadinessExperience {...data} basePath="/demo" /></AppShell>; }
