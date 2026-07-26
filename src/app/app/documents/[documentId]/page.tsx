import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentDetail } from "@/components/document-detail";
import { DocumentTransactionsPanel } from "@/components/transaction-document-links";
import { getDocument } from "@/lib/documents/service";
import { issueDocumentReadGrant } from "@/lib/documents/read-grant";
import {
  listEligibleTransactions,
  listLinkedTransactions,
} from "@/lib/documents/transaction-links";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import {
  linkAuthenticatedDocument,
  unlinkAuthenticatedDocument,
} from "@/app/app/money/[transactionId]/actions";
export const dynamic = "force-dynamic";
export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) { const context = await getContext(); const document = await getDocument(context.business.id, (await params).documentId); if (!document) notFound(); const [linkedTransactions, eligibleTransactions] = await Promise.all([listLinkedTransactions(context.business.id, document.id), listEligibleTransactions(context.business.id, document.id)]); const contentHref = document.status === "ACTIVE" && document.malwareScanStatus === "CLEAN" && document.privateReadEligible && document.storageState === "STORED_PRIVATE" ? `/api/documents/${document.id}/content?grant=${encodeURIComponent(await issueDocumentReadGrant({ actorUserId: context.user.id, businessId: context.business.id, documentId: document.id }))}` : undefined; return <AppShell mode="app" destination="documents" businessName={context.business.displayName}><DocumentDetail document={document} basePath="/app" contentHref={contentHref} /><div className="mt-6"><DocumentTransactionsPanel documentId={document.id} basePath="/app" linked={linkedTransactions.map((link) => ({ linkId: link.id, attachedAt: link.attachedAt.toISOString(), id: link.transaction.id, postedAt: link.transaction.postedAt.toISOString(), description: link.transaction.description, merchantName: link.transaction.merchantName, amount: link.transaction.amount.toFixed(2), direction: link.transaction.direction, accountName: link.transaction.account.name }))} eligible={eligibleTransactions.map((transaction) => ({ id: transaction.id, postedAt: transaction.postedAt.toISOString(), description: transaction.description, merchantName: transaction.merchantName, amount: transaction.amount.toFixed(2), direction: transaction.direction, accountName: transaction.account.name }))} linkAction={linkAuthenticatedDocument} unlinkAction={unlinkAuthenticatedDocument} /></div></AppShell>; }
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
