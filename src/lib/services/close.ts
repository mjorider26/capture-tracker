import { Prisma, type BusinessRole, type PrismaClient } from "../../generated/prisma/client";
import { balancedJournalEntry, closeReadiness, type CloseCheck } from "./close-core";

type Actor = { businessId: string; actorUserId: string; role: BusinessRole; executionMode: string };
const monthBounds = (raw: string) => {
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [year, month] = raw.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

export async function getCloseReadiness(client: PrismaClient, businessId: string, month: string) {
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const [unresolvedImports, duplicates, ownerTransfers, reimbursements, payrollMismatches, possibleAssets, incompleteDocuments, accounts, completedReconciliations, entries] = await Promise.all([
    client.externalTransaction.count({ where: { businessId, transactionDate: { lte: bounds.end }, status: { in: ["IMPORTED", "NORMALIZED", "NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } } }),
    client.externalTransaction.count({ where: { businessId, transactionDate: { lte: bounds.end }, status: "POSSIBLE_DUPLICATE" } }),
    client.ownerMoneyTransfer.count({ where: { businessId, status: "PENDING_REVIEW" } }),
    client.reimbursementClaim.count({ where: { businessId, status: { in: ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION", "APPROVED"] } } }),
    client.payrollBankMatch.count({ where: { businessId, payrollRun: { payDate: { lte: bounds.end } }, status: { not: "MATCHED" } } }),
    client.fixedAsset.count({ where: { businessId, acquisitionDate: { lte: bounds.end }, status: "POSSIBLE_REVIEW" } }),
    client.document.count({ where: { businessId, uploadedAt: { lte: bounds.end }, status: { in: ["PENDING_VALIDATION", "QUARANTINED", "REJECTED"] } } }),
    client.financialAccount.findMany({ where: { businessId, ownership: "BUSINESS", isActive: true }, select: { id: true } }),
    client.reconciliation.findMany({ where: { businessId, statementEndDate: { lte: bounds.end }, status: "COMPLETED" }, select: { financialAccountId: true }, distinct: ["financialAccountId"] }),
    client.journalEntry.findMany({ where: { businessId, status: "POSTED", entryDate: { gte: bounds.start, lte: bounds.end } }, include: { lines: { select: { debitAmount: true, creditAmount: true } } } }),
  ]);
  const reconciled = new Set(completedReconciliations.map((item) => item.financialAccountId));
  const unreconciledAccounts = accounts.filter((account) => !reconciled.has(account.id)).length;
  const unbalancedEntries = entries.filter((entry) => !balancedJournalEntry(entry.lines)).length;
  const checks: CloseCheck[] = [
    { key: "imports", label: "Imported transactions resolved", count: unresolvedImports, detail: "Classify, post, or explicitly ignore imported activity before close." },
    { key: "duplicates", label: "Possible duplicates resolved", count: duplicates, detail: "Review possible duplicates before close." },
    { key: "owner-transfers", label: "Owner transfers resolved", count: ownerTransfers, detail: "Classify company/owner transfers explicitly." },
    { key: "reimbursements", label: "Reimbursements reviewed", count: reimbursements, detail: "Review reimbursement lifecycle items." },
    { key: "payroll", label: "Payroll reconciled", count: payrollMismatches, detail: "Match payroll bank evidence or document the difference." },
    { key: "fixed-assets", label: "Possible fixed assets reviewed", count: possibleAssets, detail: "Review capitalization before close; Capture Tracker never auto-capitalizes." },
    { key: "documents", label: "Document security exceptions handled", count: incompleteDocuments, detail: "Resolve rejected or incomplete document security states." },
    { key: "reconciliations", label: "Business accounts reconciled", count: unreconciledAccounts, detail: "Complete a reconciliation for each active business account." },
    { key: "journal-integrity", label: "Journal integrity passes", count: unbalancedEntries, detail: "Every posted journal entry must balance." },
  ];
  return { month, ...bounds, ...closeReadiness(checks), journalEntryCount: entries.length };
}

export async function confirmMonthEndClose(client: PrismaClient, actor: Actor, input: { month?: string; confirmation?: string; notes?: string }) {
  if (actor.role !== "OWNER" || input.confirmation !== "on") return { ok: false as const, message: "Owner confirmation is required before locking a period." };
  const readiness = await getCloseReadiness(client, actor.businessId, input.month ?? "");
  if (!readiness) return { ok: false as const, message: "Choose a valid month to close." };
  if (readiness.status !== "READY_TO_CLOSE") return { ok: false as const, message: "This month still has close blockers and cannot be locked." };
  try { return await client.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, startsAt: { lte: readiness.start }, endsAt: { gte: readiness.end }, status: "OPEN" }, select: { id: true, version: true } });
    if (!period) return { ok: false as const, message: "No open accounting period covers this month." };
    const gate = await tx.accountingPeriod.updateMany({ where: { id: period.id, businessId: actor.businessId, status: "OPEN", version: period.version }, data: { status: "LOCKED", lockedAt: new Date(), lockedByMembershipId: actor.actorUserId, version: { increment: 1 } } });
    if (gate.count !== 1) return { ok: false as const, message: "The accounting period changed. Refresh and review it again." };
    const close = await tx.monthEndClose.upsert({ where: { businessId_periodStart_periodEnd: { businessId: actor.businessId, periodStart: readiness.start, periodEnd: readiness.end } }, create: { businessId: actor.businessId, periodStart: readiness.start, periodEnd: readiness.end, status: "CLOSED", checklistJson: readiness.checks, confirmedAt: new Date(), confirmedByUserId: actor.actorUserId, notes: input.notes?.slice(0, 1000) }, update: { status: "CLOSED", checklistJson: readiness.checks, confirmedAt: new Date(), confirmedByUserId: actor.actorUserId, notes: input.notes?.slice(0, 1000), version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "MonthEndClose", entityId: close.id, afterJson: { month: readiness.month, status: "CLOSED", accountingPeriodId: period.id }, metadataJson: { executionMode: actor.executionMode, closeChecklist: readiness.checks } } });
    return { ok: true as const, closeId: close.id };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, message: "The close could not be recorded safely. Refresh and try again." }; return { ok: false, message: "The close could not be recorded safely. Refresh and try again." }; }
}
