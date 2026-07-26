import "server-only";

import { prisma } from "@/lib/prisma";
import { decideTransactionMatch, dismissTransactionMatchRun, generateTransactionMatches, type TransactionMatchingActor } from "./transaction-matching-core";

export async function generateDocumentTransactionMatches(actor: TransactionMatchingActor, documentId: string) { return generateTransactionMatches(prisma, actor, documentId); }
export async function decideDocumentTransactionMatch(actor: TransactionMatchingActor, suggestionId: string, decision: "APPROVE" | "REJECT" | "DISMISS") { return decideTransactionMatch(prisma, actor, suggestionId, decision); }
export async function dismissDocumentTransactionMatchRun(actor: TransactionMatchingActor, runId: string) { return dismissTransactionMatchRun(prisma, actor, runId); }
export async function getDocumentTransactionMatches(businessId: string, documentId: string) {
  return prisma.documentMatchRun.findMany({ where: { businessId, documentId }, include: { extraction: { select: { id: true, sourceSha256: true, completedAt: true } }, suggestions: { include: { transaction: { select: { id: true, postedAt: true, description: true, merchantName: true, amount: true, account: { select: { name: true } } } }, history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }, orderBy: [{ rank: "asc" }, { id: "asc" }] }, history: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }, orderBy: [{ requestedAt: "desc" }, { id: "desc" }], take: 10 });
}
