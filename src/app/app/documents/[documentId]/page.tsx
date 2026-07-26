import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DocumentDetail } from "@/components/document-detail";
import { DocumentTransactionsPanel } from "@/components/transaction-document-links";
import { DocumentExtractionPanel } from "@/components/document-extraction-panel";
import { getDocument } from "@/lib/documents/service";
import { issueDocumentReadGrant } from "@/lib/documents/read-grant";
import { getDocumentExtraction } from "@/lib/documents/extraction";
import {
  listEligibleTransactions,
  listLinkedTransactions,
} from "@/lib/documents/transaction-links";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import {
  linkAuthenticatedDocument,
  unlinkAuthenticatedDocument,
} from "@/app/app/money/[transactionId]/actions";
import { runAuthenticatedExtraction, reviewAuthenticatedExtraction } from "../actions";
export const dynamic = "force-dynamic";
export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) { const context = await getContext(); const document = await getDocument(context.business.id, (await params).documentId); if (!document) notFound(); const [linkedTransactions, eligibleTransactions, attempts] = await Promise.all([listLinkedTransactions(context.business.id, document.id), listEligibleTransactions(context.business.id, document.id), getDocumentExtraction(context.business.id, document.id)]); const contentHref = document.status === "ACTIVE" && document.malwareScanStatus === "CLEAN" && document.privateReadEligible && document.storageState === "STORED_PRIVATE" ? `/api/documents/${document.id}/content?grant=${encodeURIComponent(await issueDocumentReadGrant({ actorUserId: context.user.id, businessId: context.business.id, documentId: document.id }))}` : undefined; const eligible = !!contentHref && ["application/pdf", "image/jpeg", "image/png"].includes(document.mimeType); return <AppShell mode="app" destination="documents" businessName={context.business.displayName}><DocumentDetail document={document} basePath="/app" contentHref={contentHref} /><div className="mt-6"><DocumentExtractionPanel documentId={document.id} eligible={eligible} attempts={attempts.map((attempt) => ({ id: attempt.id, status: attempt.status, adapterId: attempt.adapterId, adapterVersion: attempt.adapterVersion, sourceSha256: attempt.sourceSha256, completedAt: attempt.completedAt?.toISOString() ?? null, failureCode: attempt.failureCode, candidates: attempt.candidates.map((candidate) => ({ id: candidate.id, fieldType: candidate.fieldType, originalValue: candidate.originalValue, normalizedValue: candidate.normalizedValue, confidence: candidate.confidence.toFixed(4), reviewState: candidate.reviewState, correctedValue: candidate.correctedValue })), history: attempt.history.map((event) => ({ id: event.id, action: event.action, createdAt: event.createdAt.toISOString() })) }))} runAction={runAuthenticatedExtraction} reviewAction={reviewAuthenticatedExtraction}/></div><div className="mt-6"><DocumentTransactionsPanel documentId={document.id} basePath="/app" linked={linkedTransactions.map((link) => ({ linkId: link.id, attachedAt: link.attachedAt.toISOString(), id: link.transaction.id, postedAt: link.transaction.postedAt.toISOString(), description: link.transaction.description, merchantName: link.transaction.merchantName, amount: link.transaction.amount.toFixed(2), direction: link.transaction.direction, accountName: link.transaction.account.name }))} eligible={eligibleTransactions.map((transaction) => ({ id: transaction.id, postedAt: transaction.postedAt.toISOString(), description: transaction.description, merchantName: transaction.merchantName, amount: transaction.amount.toFixed(2), direction: transaction.direction, accountName: transaction.account.name }))} linkAction={linkAuthenticatedDocument} unlinkAction={unlinkAuthenticatedDocument} /></div></AppShell>; }
async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
