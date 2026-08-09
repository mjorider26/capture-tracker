import { type PrismaClient, type Prisma } from "../../generated/prisma/client";
import { calculateReconciliationBalances, isEligibleReconciliationAccount, parseReconciliationInput, reconciliationFinalizeSchema, reconciliationSaveSchema, reconciliationStartSchema, type ReconciliationActor, type ReconciliationResult } from "./reconciliation-core";

type Client = Pick<PrismaClient, "$transaction">;
const editable: Array<"DRAFT" | "IN_PROGRESS"> = ["DRAFT", "IN_PROGRESS"];
const atNoon = (value: string) => new Date(`${value}T12:00:00.000Z`);

function denied(actor: ReconciliationActor): ReconciliationResult | null {
  return actor.role === "OWNER" ? null : { ok: false, code: "FORBIDDEN", message: "Only business owners can change reconciliations." };
}

async function selectedTransactions(tx: Prisma.TransactionClient, businessId: string, reconciliation: { id: string; financialAccountId: string; statementStartDate: Date; statementEndDate: Date }) {
  return tx.transaction.findMany({
    where: { businessId, accountId: reconciliation.financialAccountId, status: { not: "VOIDED" }, postedAt: { gte: reconciliation.statementStartDate, lte: reconciliation.statementEndDate }, reconciliationItems: { none: { reconciliation: { status: "COMPLETED", id: { not: reconciliation.id } } } } },
    select: { id: true, amount: true, direction: true }, orderBy: [{ postedAt: "asc" }, { id: "asc" }],
  });
}

async function audit(tx: Prisma.TransactionClient, actor: ReconciliationActor, reconciliation: { id: string }, action: "CREATE" | "UPDATE", before: object | null, after: object, metadata: object) {
  await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action, entityType: "Reconciliation", entityId: reconciliation.id, beforeJson: before ?? undefined, afterJson: after, metadataJson: { executionMode: actor.executionMode, ...metadata } } });
}

export async function startReconciliation(client: Client, actor: ReconciliationActor, input: unknown): Promise<ReconciliationResult> {
  const permission = denied(actor); if (permission) return permission;
  const parsed = parseReconciliationInput(reconciliationStartSchema, input); if (!parsed.ok) return { ok: false, code: "INVALID", message: parsed.message };
  try { return await client.$transaction(async (tx) => {
    const account = await tx.financialAccount.findFirst({ where: { id: parsed.data.accountId, businessId: actor.businessId }, select: { id: true, ownership: true, type: true, openingBalance: true } });
    if (!account) return { ok: false, code: "NOT_FOUND", message: "Financial account not found." };
    if (!isEligibleReconciliationAccount(account)) return { ok: false, code: "INVALID", message: "Only business-owned cash and credit-card accounts can be reconciled." };
    const record = await tx.reconciliation.create({ data: { businessId: actor.businessId, financialAccountId: account.id, statementStartDate: atNoon(parsed.data.statementStartDate), statementEndDate: atNoon(parsed.data.statementEndDate), statementOpeningBalance: account.openingBalance, statementEndingBalance: parsed.data.statementEndingBalance, status: "DRAFT" } });
    const balances = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, []);
    await audit(tx, actor, record, "CREATE", null, { status: record.status, version: record.version }, { statementPeriod: [parsed.data.statementStartDate, parsed.data.statementEndDate], calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), selectedItemCount: 0 });
    return { ok: true, reconciliationId: record.id, nextVersion: record.version, calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), status: "DRAFT" };
  }); } catch { return { ok: false, code: "INVALID", message: "The reconciliation could not be started safely." }; }
}

export async function saveReconciliationSelection(client: Client, actor: ReconciliationActor, input: unknown): Promise<ReconciliationResult> {
  const permission = denied(actor); if (permission) return permission;
  const parsed = parseReconciliationInput(reconciliationSaveSchema, input); if (!parsed.ok) return { ok: false, code: "INVALID", message: parsed.message };
  if (new Set(parsed.data.transactionIds).size !== parsed.data.transactionIds.length) return { ok: false, code: "INVALID", message: "A transaction can only be selected once." };
  try { return await client.$transaction(async (tx) => {
    const record = await tx.reconciliation.findFirst({ where: { id: parsed.data.reconciliationId, businessId: actor.businessId }, include: { items: { select: { transactionId: true, status: true } } } });
    if (!record) return { ok: false, code: "NOT_FOUND", message: "Reconciliation not found." };
    if (!editable.includes(record.status as "DRAFT" | "IN_PROGRESS")) return { ok: false, code: "IMMUTABLE", message: "Completed reconciliations are immutable evidence." };
    if (record.version !== parsed.data.expectedVersion) return { ok: false, code: "CONFLICT", message: "This reconciliation changed. Refresh and try again." };
    const candidates = await selectedTransactions(tx, actor.businessId, record);
    const selected = candidates.filter((candidate) => parsed.data.transactionIds.includes(candidate.id));
    if (selected.length !== parsed.data.transactionIds.length) return { ok: false, code: "INVALID", message: "One or more selected transactions are no longer eligible." };
    // The conditional update is the concurrency gate. No item mutation occurs until it succeeds.
    const gate = await tx.reconciliation.updateMany({ where: { id: record.id, businessId: actor.businessId, status: { in: editable }, version: parsed.data.expectedVersion }, data: { version: { increment: 1 } } });
    if (gate.count !== 1) return { ok: false, code: "CONFLICT", message: "This reconciliation changed. Refresh and try again." };
    await tx.reconciliationItem.deleteMany({ where: { businessId: actor.businessId, reconciliationId: record.id } });
    if (selected.length) await tx.reconciliationItem.createMany({ data: selected.map((transaction) => ({ businessId: actor.businessId, reconciliationId: record.id, transactionId: transaction.id, status: "CLEARED", clearedAt: new Date() })) });
    const balances = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, selected);
    await audit(tx, actor, record, "UPDATE", { status: record.status, version: record.version, selectedItemCount: record.items.length }, { status: record.status, version: record.version + 1, selectedItemCount: selected.length }, { calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), selectedItemCount: selected.length });
    return { ok: true, reconciliationId: record.id, nextVersion: record.version + 1, calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), status: "DRAFT" };
  }); } catch { return { ok: false, code: "INVALID", message: "The reconciliation selection could not be saved safely." }; }
}

export async function finalizeReconciliation(client: Client, actor: ReconciliationActor, input: unknown): Promise<ReconciliationResult> {
  const permission = denied(actor); if (permission) return permission;
  const parsed = parseReconciliationInput(reconciliationFinalizeSchema, input); if (!parsed.ok) return { ok: false, code: "INVALID", message: parsed.message };
  try { return await client.$transaction(async (tx) => {
    const record = await tx.reconciliation.findFirst({ where: { id: parsed.data.reconciliationId, businessId: actor.businessId }, include: { items: { where: { status: "CLEARED" }, include: { transaction: { select: { id: true, amount: true, direction: true, accountId: true, postedAt: true, status: true } } } } } });
    if (!record) return { ok: false, code: "NOT_FOUND", message: "Reconciliation not found." };
    if (!editable.includes(record.status as "DRAFT" | "IN_PROGRESS")) return { ok: false, code: "IMMUTABLE", message: "Completed reconciliations are immutable evidence." };
    if (record.version !== parsed.data.expectedVersion) return { ok: false, code: "CONFLICT", message: "This reconciliation changed. Refresh and try again." };
    const unmatchedActivityCount = await tx.statementActivity.count({ where: { businessId: actor.businessId, reconciliationId: record.id, status: "UNMATCHED" } });
    if (unmatchedActivityCount) return { ok: false, code: "UNBALANCED", message: "Match all statement activity before finalizing." };
    const candidates = await selectedTransactions(tx, actor.businessId, record);
    const allowed = new Set(candidates.map((candidate) => candidate.id));
    if (record.items.some((item) => !allowed.has(item.transactionId))) return { ok: false, code: "INVALID", message: "A selected transaction is no longer eligible." };
    const balances = calculateReconciliationBalances(record.statementOpeningBalance, record.statementEndingBalance, record.items.map((item) => item.transaction));
    if (!balances.balanced) return { ok: false, code: "UNBALANCED", message: "Finalization requires an exact $0.00 difference." };
    const gate = await tx.reconciliation.updateMany({ where: { id: record.id, businessId: actor.businessId, status: { in: editable }, version: parsed.data.expectedVersion }, data: { status: "COMPLETED", completedAt: new Date(), completedByMembershipId: actor.actorUserId, version: { increment: 1 } } });
    if (gate.count !== 1) return { ok: false, code: "CONFLICT", message: "This reconciliation changed. Refresh and try again." };
    await audit(tx, actor, record, "UPDATE", { status: record.status, version: record.version }, { status: "COMPLETED", version: record.version + 1 }, { finalization: true, calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), selectedItemCount: record.items.length });
    // A first reconciliation can advance an invited client's setup gate, but
    // only after the same $0.00 finalization boundary used for every tenant.
    const onboarding = await tx.businessOnboarding.findUnique({ where: { businessId: actor.businessId } });
    if (onboarding?.cutoverDate && !onboarding.initialReconciliationComplete) {
      const complete = onboarding.openingBalancesPosted && onboarding.ownerMoneyInitialized && onboarding.payrollYtdEstablished && onboarding.fixedAssetsReviewed;
      await tx.businessOnboarding.update({ where: { businessId: actor.businessId }, data: { initialReconciliationComplete: true, status: complete ? "COMPLETED" : "IN_PROGRESS", completedAt: complete ? new Date() : null, booksCurrentThrough: complete ? record.statementEndDate : null } });
    }
    return { ok: true, reconciliationId: record.id, nextVersion: record.version + 1, calculatedBalance: balances.calculatedBalance.toFixed(2), difference: balances.difference.toFixed(2), status: "COMPLETED" };
  }); } catch { return { ok: false, code: "INVALID", message: "The reconciliation could not be finalized safely." }; }
}
