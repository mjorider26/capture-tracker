import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { TransactionDocumentsPanel } from "@/components/transaction-document-links";
import { TransactionDetailExperience } from "@/components/transaction-detail-experience";
import { getTransactionDetailForBusiness } from "@/lib/data/transaction-detail";
import {
  listEligibleDocuments,
  listLinkedDocuments,
} from "@/lib/documents/transaction-links";
import { issueDocumentReadGrant } from "@/lib/documents/read-grant";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";

import {
  linkAuthenticatedDocument,
  reviewAuthenticatedTransaction,
  unlinkAuthenticatedDocument,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function ApplicationTransactionPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const context = await getContext();
  const detail = await getTransactionDetailForBusiness(
    context.business.id,
    (await params).transactionId,
  );
  if (!detail) notFound();
  const [linkedDocuments, eligibleDocuments] = await Promise.all([
    listLinkedDocuments(context.business.id, detail.id),
    listEligibleDocuments(context.business.id, detail.id),
  ]);
  const documentPanel = await Promise.all(
    linkedDocuments.map(async (link) => ({
      linkId: link.id,
      id: link.document.id,
      displayName: link.document.displayName,
      originalFilename: link.document.originalFilename,
      category: link.document.category,
      documentDate: link.document.documentDate?.toISOString() ?? null,
      mimeType: link.document.mimeType,
      attachedAt: link.attachedAt.toISOString(),
      contentHref:
        link.document.malwareScanStatus === "CLEAN" &&
        link.document.storageState === "STORED_PRIVATE" &&
        link.document.privateReadEligible
          ? `/api/documents/${link.document.id}/content?grant=${encodeURIComponent(
              await issueDocumentReadGrant({
                actorUserId: context.user.id,
                businessId: context.business.id,
                documentId: link.document.id,
              }),
            )}`
          : undefined,
    })),
  );
  return (
    <AppShell
      mode="app"
      destination="money"
      businessName={context.business.displayName}
    >
      <TransactionDetailExperience
        detail={detail}
        basePath="/app"
        action={reviewAuthenticatedTransaction}
      />
      <TransactionDocumentsPanel
        transactionId={detail.id}
        basePath="/app"
        linked={documentPanel}
        eligible={eligibleDocuments.map((document) => ({
          ...document,
          documentDate: document.documentDate?.toISOString() ?? null,
        }))}
        linkAction={linkAuthenticatedDocument}
        unlinkAction={unlinkAuthenticatedDocument}
      />
    </AppShell>
  );
}

async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
