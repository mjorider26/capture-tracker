import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import { type ReconciliationActor } from "./reconciliation-core";
import { statementMatchSchema, statementUnmatchSchema } from "./statement-activity-matching-core";

type Client = Pick<PrismaClient, "$transaction">;
const editable = ["DRAFT", "IN_PROGRESS"] as const;
type Result = { ok: true; state: "MATCHED" | "REJECTED" | "UNMATCHED" } | { ok: false; code: "INVALID" | "NOT_FOUND" | "STALE" | "IMMUTABLE" | "FORBIDDEN" };

async function audit(tx: Prisma.TransactionClient, actor: ReconciliationActor, action: string, activityId: string, metadata: object) {
  await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "StatementActivity", entityId: activityId, metadataJson: { executionMode: actor.executionMode, statementActivityAction: action, ...metadata } } });
}

export async function approveStatementActivityMatch(client: Client, actor: ReconciliationActor, input: unknown): Promise<Result> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN" };
  const parsed = statementMatchSchema.safeParse(input); if (!parsed.success) return { ok: false, code: "INVALID" };
  try { return await client.$transaction(async (tx) => {
    const activity = await tx.statementActivity.findFirst({ where: { id: parsed.data.statementActivityId, businessId: actor.businessId }, include: { reconciliation: true } });
    if (!activity) return { ok: false as const, code: "NOT_FOUND" as const };
    if (!editable.includes(activity.reconciliation.status as typeof editable[number])) return { ok: false as const, code: "IMMUTABLE" as const };
    if (activity.version !== parsed.data.expectedActivityVersion || activity.reconciliation.version !== parsed.data.expectedReconciliationVersion || activity.status !== "UNMATCHED") return { ok: false as const, code: "STALE" as const };
    const transaction = await tx.transaction.findFirst({ where: { id: parsed.data.transactionId, businessId: actor.businessId, accountId: activity.reconciliation.financialAccountId, status: { in: ["APPROVED", "EXCLUDED"] }, amount: activity.amount, direction: activity.direction, postedAt: { gte: activity.reconciliation.statementStartDate, lte: activity.reconciliation.statementEndDate }, corrections: { none: {} }, journalEntry: { reversedByEntries: { none: {} } }, matchedStatementActivities: { none: {} } }, select: { id: true, version: true } });
    if (!transaction || transaction.version !== parsed.data.expectedTransactionVersion) return { ok: false as const, code: "STALE" as const };
    const gate = await tx.reconciliation.updateMany({ where: { id: activity.reconciliationId, businessId: actor.businessId, status: { in: [...editable] }, version: parsed.data.expectedReconciliationVersion }, data: { version: { increment: 1 } } });
    if (!gate.count) return { ok: false as const, code: "STALE" as const };
    const claimed = await tx.statementActivity.updateMany({ where: { id: activity.id, businessId: actor.businessId, status: "UNMATCHED", version: parsed.data.expectedActivityVersion }, data: { status: "MATCHED", matchedTransactionId: transaction.id, matchedAt: new Date(), version: { increment: 1 } } });
    if (!claimed.count) return { ok: false as const, code: "STALE" as const };
    await tx.reconciliationItem.upsert({ where: { businessId_reconciliationId_transactionId: { businessId: actor.businessId, reconciliationId: activity.reconciliationId, transactionId: transaction.id } }, create: { businessId: actor.businessId, reconciliationId: activity.reconciliationId, transactionId: transaction.id, status: "CLEARED", clearedAt: new Date() }, update: { status: "CLEARED", clearedAt: new Date() } });
    await audit(tx, actor, "MATCHED", activity.id, { reconciliationId: activity.reconciliationId });
    return { ok: true as const, state: "MATCHED" as const };
  }); } catch { return { ok: false, code: "STALE" }; }
}

export async function rejectStatementActivityCandidate(client: Client, actor: ReconciliationActor, input: unknown): Promise<Result> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN" };
  const parsed = statementMatchSchema.safeParse(input); if (!parsed.success) return { ok: false, code: "INVALID" };
  try { return await client.$transaction(async (tx) => {
    const activity = await tx.statementActivity.findFirst({ where: { id: parsed.data.statementActivityId, businessId: actor.businessId }, include: { reconciliation: true } });
    const transaction = await tx.transaction.findFirst({ where: { id: parsed.data.transactionId, businessId: actor.businessId }, select: { id: true, version: true } });
    if (!activity || !transaction) return { ok: false as const, code: "NOT_FOUND" as const };
    if (!editable.includes(activity.reconciliation.status as typeof editable[number])) return { ok: false as const, code: "IMMUTABLE" as const };
    if (activity.status !== "UNMATCHED" || activity.version !== parsed.data.expectedActivityVersion || transaction.version !== parsed.data.expectedTransactionVersion || activity.reconciliation.version !== parsed.data.expectedReconciliationVersion) return { ok: false as const, code: "STALE" as const };
    await tx.statementActivityCandidateDecision.upsert({ where: { businessId_statementActivityId_transactionId_activityVersion_transactionVersion: { businessId: actor.businessId, statementActivityId: activity.id, transactionId: transaction.id, activityVersion: activity.version, transactionVersion: transaction.version } }, create: { businessId: actor.businessId, statementActivityId: activity.id, transactionId: transaction.id, activityVersion: activity.version, transactionVersion: transaction.version }, update: {} });
    await audit(tx, actor, "CANDIDATE_REJECTED", activity.id, { reconciliationId: activity.reconciliationId });
    return { ok: true as const, state: "REJECTED" as const };
  }); } catch { return { ok: false, code: "STALE" }; }
}

export async function unmatchStatementActivity(client: Client, actor: ReconciliationActor, input: unknown): Promise<Result> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN" };
  const parsed = statementUnmatchSchema.safeParse(input); if (!parsed.success) return { ok: false, code: "INVALID" };
  try { return await client.$transaction(async (tx) => {
    const activity = await tx.statementActivity.findFirst({ where: { id: parsed.data.statementActivityId, businessId: actor.businessId }, include: { reconciliation: true } });
    if (!activity) return { ok: false as const, code: "NOT_FOUND" as const };
    if (!editable.includes(activity.reconciliation.status as typeof editable[number])) return { ok: false as const, code: "IMMUTABLE" as const };
    if (activity.status !== "MATCHED" || activity.version !== parsed.data.expectedActivityVersion || activity.reconciliation.version !== parsed.data.expectedReconciliationVersion || !activity.matchedTransactionId) return { ok: false as const, code: "STALE" as const };
    const gate = await tx.reconciliation.updateMany({ where: { id: activity.reconciliationId, businessId: actor.businessId, status: { in: [...editable] }, version: parsed.data.expectedReconciliationVersion }, data: { version: { increment: 1 } } });
    if (!gate.count) return { ok: false as const, code: "STALE" as const };
    await tx.statementActivity.update({ where: { id: activity.id }, data: { status: "UNMATCHED", matchedTransactionId: null, matchedAt: null, version: { increment: 1 } } });
    await tx.reconciliationItem.deleteMany({ where: { businessId: actor.businessId, reconciliationId: activity.reconciliationId, transactionId: activity.matchedTransactionId } });
    await audit(tx, actor, "UNMATCHED", activity.id, { reconciliationId: activity.reconciliationId });
    return { ok: true as const, state: "UNMATCHED" as const };
  }); } catch { return { ok: false, code: "STALE" }; }
}
