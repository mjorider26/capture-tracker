import "server-only";

import { prisma } from "@/lib/prisma";
import {
  linkDocumentToTransactionCore,
  unlinkDocumentFromTransactionCore,
  type TransactionDocumentActor,
  type TransactionDocumentLinkOutcome,
} from "./transaction-links-core";

type Actor = TransactionDocumentActor;
type Outcome = TransactionDocumentLinkOutcome;

const activeDocument = { status: "ACTIVE" as const, storageState: "STORED_PRIVATE" as const, privateReadEligible: true, deletedAt: null };

export async function linkDocumentToTransaction(actor: Actor, transactionId: string, documentId: string): Promise<Outcome> {
  return linkDocumentToTransactionCore(prisma, actor, transactionId, documentId);
}

export async function unlinkDocumentFromTransaction(actor: Actor, linkId: string, reason?: string): Promise<Outcome> {
  return unlinkDocumentFromTransactionCore(prisma, actor, linkId, reason);
}

export async function listEligibleDocuments(businessId: string, transactionId: string, query = "") {
  const value = query.trim().slice(0, 120);
  return prisma.document.findMany({ where: { businessId, ...activeDocument, transactions: { none: { transactionId, unlinkedAt: null } }, ...(value ? { OR: [{ displayName: { contains: value, mode: "insensitive" } }, { originalFilename: { contains: value, mode: "insensitive" } }] } : {}) }, select: { id: true, displayName: true, originalFilename: true, category: true, documentDate: true, mimeType: true }, orderBy: { createdAt: "desc" }, take: 50 });
}

export async function listLinkedDocuments(businessId: string, transactionId: string) {
  return prisma.transactionDocument.findMany({ where: { businessId, transactionId, unlinkedAt: null }, select: { id: true, attachedAt: true, document: { select: { id: true, displayName: true, originalFilename: true, category: true, documentDate: true, mimeType: true, malwareScanStatus: true, storageState: true, privateReadEligible: true } } }, orderBy: { attachedAt: "desc" }, take: 50 });
}

export async function listLinkedTransactions(businessId: string, documentId: string) {
  return prisma.transactionDocument.findMany({ where: { businessId, documentId, unlinkedAt: null }, select: { id: true, attachedAt: true, transaction: { select: { id: true, postedAt: true, description: true, merchantName: true, amount: true, direction: true, account: { select: { name: true } } } } }, orderBy: { attachedAt: "desc" }, take: 50 });
}

export async function listEligibleTransactions(businessId: string, documentId: string, query = "") {
  const value = query.trim().slice(0, 120);
  return prisma.transaction.findMany({ where: { businessId, voidedAt: null, documents: { none: { documentId, unlinkedAt: null } }, ...(value ? { OR: [{ description: { contains: value, mode: "insensitive" } }, { merchantName: { contains: value, mode: "insensitive" } }] } : {}) }, select: { id: true, postedAt: true, description: true, merchantName: true, amount: true, direction: true, account: { select: { name: true } } }, orderBy: [{ postedAt: "desc" }, { id: "desc" }], take: 50 });
}

export async function listTransactionDocumentHistory(businessId: string, transactionId: string, documentId: string) {
  return prisma.transactionDocumentHistory.findMany({ where: { businessId, link: { transactionId, documentId } }, select: { id: true, action: true, actorUserId: true, note: true, createdAt: true, transactionDocumentId: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 });
}
