import { type LedgerAccountSubtype, type PrismaClient } from "../../generated/prisma/client";
import type { ReimbursementActor } from "./reimbursement-core";
import { ensureWorkspaceAccountingFoundation } from "@/lib/accounting/workspace-bootstrap";

type Client = Pick<PrismaClient, "$transaction">;
type Result = { ok: true; journalEntryId: string } | { ok: false; message: string };

const expenseSubtype = (type: string): LedgerAccountSubtype => ({
  MILEAGE: "MILEAGE_EXPENSE", AIRFARE: "TRAVEL_EXPENSE", LODGING: "LODGING_EXPENSE", MEALS: "MEALS_EXPENSE",
  PARKING: "TRAVEL_EXPENSE", TOLLS: "TRAVEL_EXPENSE", SUPPLIES: "OFFICE_SUPPLIES_EXPENSE", PHONE: "PHONE_EXPENSE",
  INTERNET: "INTERNET_EXPENSE", EDUCATION: "PROFESSIONAL_FEES_EXPENSE", OTHER: "OTHER_EXPENSE",
})[type] as LedgerAccountSubtype ?? "OTHER_EXPENSE";

/** Posts a reviewed personally-paid expense once: debit expense, credit reimbursement payable. */
export async function approveReimbursementClaim(client: Client, actor: ReimbursementActor, claimId?: string): Promise<Result> {
  if (actor.role !== "OWNER" || !claimId) return { ok: false, message: "Only the business owner can approve a reimbursement claim." };
  try {
    await ensureWorkspaceAccountingFoundation(actor.businessId);
    return await client.$transaction(async (tx) => {
      const claim = await tx.reimbursementClaim.findFirst({ where: { id: claimId, businessId: actor.businessId, status: { in: ["DRAFT", "SUBMITTED"] } }, include: { expenses: true, journalEntry: { select: { id: true } } } });
      if (!claim || !claim.expenses.length) return { ok: false as const, message: "This reimbursement claim is unavailable for approval." };
      if (claim.journalEntry) return { ok: true as const, journalEntryId: claim.journalEntry.id };
      const date = claim.expenses[0].incurredAt;
      const [period, payable] = await Promise.all([
        tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: date }, endsAt: { gte: date } }, select: { id: true } }),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, subtype: "REIMBURSEMENT_PAYABLE", isActive: true }, select: { id: true } }),
      ]);
      if (!period || !payable) return { ok: false as const, message: "An open accounting period and reimbursement-payable account are required." };
      const expenseAccounts = await tx.ledgerAccount.findMany({ where: { businessId: actor.businessId, isActive: true, subtype: { in: [...new Set(claim.expenses.map((expense) => expenseSubtype(expense.expenseType)))] } }, select: { id: true, subtype: true } });
      const accounts = new Map(expenseAccounts.map((account) => [account.subtype, account.id]));
      if (claim.expenses.some((expense) => !accounts.get(expenseSubtype(expense.expenseType)))) return { ok: false as const, message: "A required expense account is unavailable. Ask the owner or CPA to configure the chart of accounts." };
      const journal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `RMB-${claim.id}`, entryDate: date, description: "Approved personally paid business expense", status: "DRAFT", sourceType: "REIMBURSEMENT_CLAIM", sourceEntityId: claim.id, reimbursementClaimId: claim.id, approvedByMembershipId: actor.actorUserId } });
      await tx.journalLine.createMany({ data: [
        ...claim.expenses.map((expense, index) => ({ businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: accounts.get(expenseSubtype(expense.expenseType))!, lineNumber: index + 1, debitAmount: expense.amount, creditAmount: "0", memo: expense.businessPurpose })),
        { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: payable.id, lineNumber: claim.expenses.length + 1, debitAmount: "0", creditAmount: claim.totalAmount, memo: "Reimbursement payable" },
      ] });
      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
      await tx.reimbursementClaim.update({ where: { id: claim.id }, data: { status: "APPROVED", approvedAt: new Date(), version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "APPROVE", entityType: "ReimbursementClaim", entityId: claim.id, afterJson: { status: "APPROVED", journalEntryId: journal.id }, metadataJson: { executionMode: actor.executionMode, accountingEffect: "expense-and-payable-posted" } } });
      return { ok: true as const, journalEntryId: journal.id };
    });
  } catch { return { ok: false, message: "The reimbursement could not be approved safely. Refresh and try again." }; }
}

/** Matches exact company-bank evidence to an approved claim: debit payable, credit cash. */
export async function matchReimbursementPayment(client: Client, actor: ReimbursementActor, input: { claimId?: string; externalTransactionId?: string }): Promise<Result> {
  if (actor.role !== "OWNER" || !input.claimId || !input.externalTransactionId) return { ok: false, message: "The reimbursement payment match is invalid." };
  try {
    await ensureWorkspaceAccountingFoundation(actor.businessId);
    return await client.$transaction(async (tx) => {
      const [claim, external, payable] = await Promise.all([
        tx.reimbursementClaim.findFirst({ where: { id: input.claimId, businessId: actor.businessId, status: "APPROVED", paymentTransactionId: null }, select: { id: true, totalAmount: true } }),
        tx.externalTransaction.findFirst({ where: { id: input.externalTransactionId, businessId: actor.businessId, postedTransactionId: null, direction: "OUTFLOW", status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, include: { financialAccount: { include: { ledgerAccount: true } } } }),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, subtype: "REIMBURSEMENT_PAYABLE", isActive: true }, select: { id: true } }),
      ]);
      if (!claim || !external?.financialAccount.ledgerAccount || !payable) return { ok: false as const, message: "The approved claim, bank evidence, or reimbursement-payable account is unavailable." };
      if (!claim.totalAmount.equals(external.amount)) return { ok: false as const, message: "The selected bank evidence does not exactly match this reimbursement. Ambiguous payments are not forced." };
      const period = await tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: external.transactionDate }, endsAt: { gte: external.transactionDate } }, select: { id: true } });
      if (!period) return { ok: false as const, message: "The payment date belongs to a closed accounting period." };
      const transaction = await tx.transaction.create({ data: { businessId: actor.businessId, accountId: external.financialAccountId, postedAt: external.transactionDate, description: external.description, merchantName: external.normalizedMerchant, amount: external.amount, direction: external.direction, intent: "BUSINESS", status: "APPROVED", sourceReference: external.externalTransactionId ?? `reimbursement:${external.id}`, approvedAt: new Date(), approvedByMembershipId: actor.actorUserId } });
      const journal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `RMP-${claim.id}`, entryDate: external.transactionDate, description: "Matched reimbursement payment", status: "DRAFT", sourceType: "REIMBURSEMENT_PAYMENT", sourceEntityId: claim.id, transactionId: transaction.id, approvedByMembershipId: actor.actorUserId } });
      await tx.journalLine.createMany({ data: [
        { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: payable.id, lineNumber: 1, debitAmount: claim.totalAmount, creditAmount: "0", memo: "Reimbursement payable settled" },
        { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: external.financialAccount.ledgerAccount.id, lineNumber: 2, debitAmount: "0", creditAmount: claim.totalAmount, memo: "Company cash payment" },
      ] });
      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
      const claimed = await tx.externalTransaction.updateMany({ where: { id: external.id, businessId: actor.businessId, postedTransactionId: null }, data: { status: "POSTED", postedTransactionId: transaction.id, reviewedAt: new Date(), reviewedByUserId: actor.actorUserId, version: { increment: 1 } } });
      if (claimed.count !== 1) throw new Error("Concurrent reimbursement payment match");
      await tx.reimbursementClaim.update({ where: { id: claim.id }, data: { status: "PAID", paymentTransactionId: transaction.id, paidAt: new Date(), version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "ReimbursementClaim", entityId: claim.id, afterJson: { status: "PAID", journalEntryId: journal.id, transactionId: transaction.id }, metadataJson: { executionMode: actor.executionMode, accountingEffect: "payable-settled" } } });
      return { ok: true as const, journalEntryId: journal.id };
    });
  } catch { return { ok: false, message: "The reimbursement payment could not be matched safely. Refresh and try again." }; }
}
