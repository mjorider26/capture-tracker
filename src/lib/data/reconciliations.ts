import "server-only";
import { Prisma } from "../../generated/prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../prisma";
import { calculateReconciliationBalances } from "../services/reconciliation-core";

const validId = (value: string) => /^[A-Za-z0-9_-]{1,191}$/.test(value);
const money = (value: Prisma.Decimal) => value.toFixed(2);
export type ReconciliationListItem = { id: string; accountName: string; statementStartDate: string; statementEndDate: string; statementEndingBalance: string; calculatedBalance: string; difference: string; status: string; clearedItemCount: number; version: number; completedAt: string | null };

export async function getReconciliations(businessId: string): Promise<ReconciliationListItem[]> {
  noStore(); const records = await prisma.reconciliation.findMany({ where: { businessId }, include: { financialAccount: { select: { name: true } }, items: { where: { status: "CLEARED" }, include: { transaction: { select: { amount: true, direction: true } } } } }, orderBy: [{ statementEndDate: "desc" }, { id: "asc" }] });
  return records.map((record) => { const balance = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, record.items.map((item) => item.transaction)); return { id: record.id, accountName: record.financialAccount.name, statementStartDate: record.statementStartDate.toISOString(), statementEndDate: record.statementEndDate.toISOString(), statementEndingBalance: money(record.statementEndingBalance), calculatedBalance: money(balance.calculatedBalance), difference: money(balance.difference), status: record.status, clearedItemCount: record.items.length, version: record.version, completedAt: record.completedAt?.toISOString() ?? null }; });
}

export async function getReconciliationDetail(businessId: string, reconciliationId: string) {
  noStore(); if (!validId(reconciliationId)) return null;
  const record = await prisma.reconciliation.findFirst({ where: { id: reconciliationId, businessId }, include: { financialAccount: { select: { name: true, ownership: true, type: true } }, items: { where: { status: "CLEARED" }, select: { transactionId: true } } } }); if (!record) return null;
  const candidates = await prisma.transaction.findMany({ where: { businessId, accountId: record.financialAccountId, status: { not: "VOIDED" }, postedAt: { gte: record.statementStartDate, lte: record.statementEndDate }, reconciliationItems: { none: { reconciliation: { status: "COMPLETED", id: { not: record.id } } } } }, select: { id: true, postedAt: true, description: true, amount: true, direction: true, status: true }, orderBy: [{ postedAt: "asc" }, { id: "asc" }] });
  const selected = new Set(record.items.map((item) => item.transactionId)); const balance = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, candidates.filter((candidate) => selected.has(candidate.id)));
  return { id: record.id, accountName: record.financialAccount.name, statementStartDate: record.statementStartDate.toISOString(), statementEndDate: record.statementEndDate.toISOString(), statementOpeningBalance: money(record.statementOpeningBalance), statementEndingBalance: money(record.statementEndingBalance), calculatedBalance: money(balance.calculatedBalance), difference: money(balance.difference), status: record.status, version: record.version, completedAt: record.completedAt?.toISOString() ?? null, selectedIds: [...selected], candidates: candidates.map((item) => ({ ...item, postedAt: item.postedAt.toISOString(), amount: money(item.amount) })) };
}
