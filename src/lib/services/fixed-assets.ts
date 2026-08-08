import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const inputSchema = z.object({ name: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(100), vendor: z.string().trim().max(180).optional(), acquisitionDate: date, acquisitionCost: z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/).refine((value) => Number(value) > 0), placedInServiceDate: date.optional().or(z.literal("")), sourceExternalTransactionId: id.optional().or(z.literal("")), sourceTransactionId: id.optional().or(z.literal("")), documentId: id.optional().or(z.literal("")), workpaperNotes: z.string().trim().max(2000).optional(), cpaNotes: z.string().trim().max(2000).optional() });
type Actor = { businessId: string; actorUserId: string; role: "OWNER" | "ADVISOR"; executionMode: string };
const noon = (value: string) => new Date(`${value}T12:00:00.000Z`);

export async function recordFixedAssetReview(client: Pick<PrismaClient, "$transaction">, actor: Actor, input: unknown) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can create a fixed-asset workpaper." };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Fixed-asset input is invalid." };
  const data = parsed.data;
  if (data.placedInServiceDate && data.placedInServiceDate < data.acquisitionDate) return { ok: false as const, message: "Placed-in-service date cannot precede acquisition." };
  try { return await client.$transaction(async (tx) => {
    const [external, transaction, document] = await Promise.all([
      data.sourceExternalTransactionId ? tx.externalTransaction.findFirst({ where: { id: data.sourceExternalTransactionId, businessId: actor.businessId }, select: { id: true } }) : Promise.resolve(null),
      data.sourceTransactionId ? tx.transaction.findFirst({ where: { id: data.sourceTransactionId, businessId: actor.businessId }, select: { id: true } }) : Promise.resolve(null),
      data.documentId ? tx.document.findFirst({ where: { id: data.documentId, businessId: actor.businessId, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (data.sourceExternalTransactionId && !external || data.sourceTransactionId && !transaction || data.documentId && !document) return { ok: false as const, message: "One selected supporting record is unavailable." };
    const asset = await tx.fixedAsset.create({ data: { businessId: actor.businessId, name: data.name, category: data.category, vendor: data.vendor || null, acquisitionDate: noon(data.acquisitionDate), acquisitionCost: data.acquisitionCost, placedInServiceDate: data.placedInServiceDate ? noon(data.placedInServiceDate) : null, status: "POSSIBLE_REVIEW", sourceExternalTransactionId: external?.id, sourceTransactionId: transaction?.id, documentId: document?.id, workpaperNotes: data.workpaperNotes || null, cpaNotes: data.cpaNotes || null } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "FixedAsset", entityId: asset.id, afterJson: { status: "POSSIBLE_REVIEW", acquisitionCost: data.acquisitionCost, acquisitionDate: data.acquisitionDate }, metadataJson: { executionMode: actor.executionMode, accountingEffect: "none", requiresCapitalizationReview: true } } });
    return { ok: true as const, assetId: asset.id };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, message: "The fixed-asset workpaper could not be saved safely." }; return { ok: false, message: "The fixed-asset workpaper could not be saved safely." }; }
}
