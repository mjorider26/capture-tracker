import "server-only";

import { prisma } from "@/lib/prisma";
import { getPrivateDocumentStorage } from "./r2-storage";
import { createExtractionProvider } from "./extraction-provider";
import { type ExtractionActor, reviewExtractionCandidate, runExtraction } from "./extraction-core";

export async function extractDocument(actor: ExtractionActor, documentId: string) {
  return runExtraction(prisma, async (key) => {
    const object = await (await getPrivateDocumentStorage()).getActive(key);
    if (!object) throw new Error("Private document object is unavailable.");
    return new Uint8Array(await object.arrayBuffer());
  }, createExtractionProvider(), actor, documentId);
}
export async function reviewDocumentExtraction(actor: ExtractionActor, candidateId: string, review: "ACCEPTED" | "CORRECTED" | "REJECTED", correctedValue?: string) {
  return reviewExtractionCandidate(prisma, actor, candidateId, review, correctedValue);
}
export async function getDocumentExtraction(businessId: string, documentId: string) {
  return prisma.documentExtractionAttempt.findMany({ where: { businessId, documentId }, include: { candidates: { orderBy: { createdAt: "asc" } }, history: { orderBy: { createdAt: "asc" } } }, orderBy: { requestedAt: "desc" }, take: 10 });
}
