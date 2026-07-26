import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TransactionDocumentsPanel } from "@/components/transaction-document-links";
import { TransactionDetailExperience } from "@/components/transaction-detail-experience";
import { getTransactionDetailForBusiness } from "@/lib/data/transaction-detail";
import { listEligibleDocuments, listLinkedDocuments } from "@/lib/documents/transaction-links";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { linkDemoDocument, reviewDemoTransaction, unlinkDemoDocument } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function DemoTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  const detail = await getTransactionDetailForBusiness(
    context.businessId,
    (await params).transactionId,
  );
  if (!detail) notFound();
  const [linkedDocuments, eligibleDocuments] = await Promise.all([listLinkedDocuments(context.businessId, detail.id), listEligibleDocuments(context.businessId, detail.id)]);
  return (
    <AppShell
      mode="demo"
      destination="money"
      businessName={context.businessName}
    >
      <TransactionDetailExperience
        detail={detail}
        basePath="/demo"
        action={reviewDemoTransaction}
      />
      <TransactionDocumentsPanel transactionId={detail.id} basePath="/demo" linked={linkedDocuments.map((link) => ({ linkId: link.id, id: link.document.id, displayName: link.document.displayName, originalFilename: link.document.originalFilename, category: link.document.category, documentDate: link.document.documentDate?.toISOString() ?? null, mimeType: link.document.mimeType, attachedAt: link.attachedAt.toISOString() }))} eligible={eligibleDocuments.map((document) => ({ ...document, documentDate: document.documentDate?.toISOString() ?? null }))} linkAction={linkDemoDocument} unlinkAction={unlinkDemoDocument}/>
    </AppShell>
  );
}
