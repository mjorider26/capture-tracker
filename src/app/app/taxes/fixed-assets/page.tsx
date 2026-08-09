import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FixedAssetsExperience } from "@/components/fixed-assets-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { prisma } from "@/lib/prisma";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { approveAuthenticatedFixedAsset, createAuthenticatedFixedAsset } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function FixedAssetsPage() {
  let context;
  try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  const [assets, documents] = await Promise.all([
    prisma.fixedAsset.findMany({
      where: { businessId: context.business.id, status: { not: "VOIDED" } },
      select: {
        id: true, name: true, category: true, vendor: true, acquisitionDate: true, acquisitionCost: true, status: true, version: true,
        placedInServiceDate: true, approvedAt: true, documentId: true,
        sourceExternalTransaction: { select: { description: true, transactionDate: true } },
        sourceTransaction: { select: { description: true, postedAt: true } },
      }, orderBy: [{ acquisitionDate: "desc" }, { id: "desc" }],
    }),
    prisma.document.findMany({ where: { businessId: context.business.id, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true, originalFilename: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return <AppShell mode="app" destination="taxes" businessName={context.business.displayName}><TaxesNav basePath="/app" /><FixedAssetsExperience action={createAuthenticatedFixedAsset} approvalAction={approveAuthenticatedFixedAsset} data={{
    assets: assets.map((asset) => ({
      id: asset.id, name: asset.name, category: asset.category, vendor: asset.vendor, acquisitionDate: asset.acquisitionDate.toISOString(), cost: asset.acquisitionCost.toFixed(2), status: asset.status, version: asset.version,
      placedInServiceDate: asset.placedInServiceDate?.toISOString() ?? null, approvedAt: asset.approvedAt?.toISOString() ?? null, hasDocument: Boolean(asset.documentId),
      sourceDescription: asset.sourceExternalTransaction ? `Imported transaction: ${asset.sourceExternalTransaction.description}` : asset.sourceTransaction ? `Recorded transaction: ${asset.sourceTransaction.description}` : null,
    })), documents,
  }} /></AppShell>;
}
