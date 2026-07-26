"use server";
import { revalidatePath } from "next/cache";
import { seedDemoDocuments, transitionDocument } from "@/lib/documents/service";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
export async function createDemoDocuments() { const context = await resolveLocalDemoContext(); if (!context) return; await seedDemoDocuments({ businessId: context.businessId, actorUserId: context.userId }); revalidatePath("/demo/documents"); }
export async function transitionDemoDocument(documentId: string, status: "ACTIVE" | "QUARANTINED") { const context = await resolveLocalDemoContext(); if (!context) return; await transitionDocument({ businessId: context.businessId, actorUserId: context.userId }, documentId, status, status === "QUARANTINED" ? "SYNTHETIC_REVIEW" : undefined, "Synthetic metadata-only demo transition."); revalidatePath(`/demo/documents/${documentId}`); }
