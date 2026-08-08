import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OwnerCompensationExperience } from "@/components/taxes-experience";
import { ReasonableCompWorkpaper } from "@/components/reasonable-comp-workpaper";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxesDashboard } from "@/lib/data/taxes";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";
import { prisma } from "@/lib/prisma";
import { createAuthenticatedCompensationWorkpaper } from "./actions";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };
async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
export default async function OwnerCompensationPage() {
  const context = await getContext();
  const [data, documents, workpapers] = await Promise.all([
    getTaxesDashboard(context.business.id),
    prisma.document.findMany({ where: { businessId: context.business.id, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true, originalFilename: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.reasonableCompWorkpaper.findMany({ where: { businessId: context.business.id }, select: { id: true, effectiveStart: true, targetLow: true, targetHigh: true, reviewDate: true }, orderBy: { effectiveStart: "desc" }, take: 20 }),
  ]);
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={context.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <OwnerCompensationExperience data={data} />
      <ReasonableCompWorkpaper action={createAuthenticatedCompensationWorkpaper} documents={documents} workpapers={workpapers.map((item) => ({ id: item.id, effectiveStart: item.effectiveStart.toISOString(), targetLow: item.targetLow?.toFixed(2) ?? null, targetHigh: item.targetHigh?.toFixed(2) ?? null, reviewDate: item.reviewDate?.toISOString() ?? null }))} />
    </AppShell>
  );
}
