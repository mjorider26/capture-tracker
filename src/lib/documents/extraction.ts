import "server-only";

import { prisma } from "@/lib/prisma";
import { readLocalActive } from "./secure-upload";
import { createExtractionProvider } from "./extraction-provider";
import { type ExtractionActor, reviewExtractionCandidate, runExtraction } from "./extraction-core";

export async function extractDocument(actor: ExtractionActor, documentId: string) {
  return runExtraction(prisma, async (key) => new Uint8Array(await readLocalActive(key)), createExtractionProvider(), actor, documentId);
}
export async function reviewDocumentExtraction(actor: ExtractionActor, candidateId: string, review: "ACCEPTED" | "CORRECTED" | "REJECTED", correctedValue?: string) {
  return reviewExtractionCandidate(prisma, actor, candidateId, review, correctedValue);
}
export async function getDocumentExtraction(businessId: string, documentId: string) {
  return prisma.documentExtractionAttempt.findMany({ where: { businessId, documentId }, include: { candidates: { orderBy: { createdAt: "asc" } }, history: { orderBy: { createdAt: "asc" } } }, orderBy: { requestedAt: "desc" }, take: 10 });
}
