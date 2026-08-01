import { Prisma, type PrismaClient } from "../../generated/prisma/client";

import { accountingForManualTransaction, type ManualTransactionActor } from "./manual-transaction-core";
import { correctionJournalLines, parseTransactionDate, transactionCorrectionSchema } from "./transaction-correction-core";

type Client = Pick<PrismaClient, "$transaction">;

export type TransactionCorrectionResult =
  | { ok: true; code: "CORRECTED" | "ALREADY_CORRECTED"; transactionId: string; reversalJournalEntryId: string; replacementJournalEntryId: string }
  | { ok: false; code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "NO_OPEN_PERIOD" | "CONFLICT" | "SAFE_FAILURE"; message: string };

async function replay(client: PrismaClient, actor: ManualTransactionActor, correctionKey: string, transactionId: string): Promise<TransactionCorrectionResult | null> {
  const existing = await client.transaction.findFirst({ where: { businessId: actor.businessId, correctionKey }, select: { id: true, correctionOfId: true, correctionOf: { select: { correctionReversalJournal: { select: { id: true } } } }, journalEntry: { select: { id: true } } } });
  if (!existing) return null;
  if (existing.correctionOfId !== transactionId || !existing.correctionOf?.correctionReversalJournal || !existing.journalEntry)
    return { ok: false, code: "CONFLICT", message: "This correction request was already used with different facts." };
  return { ok: true, code: "ALREADY_CORRECTED", transactionId: existing.id, reversalJournalEntryId: existing.correctionOf.correctionReversalJournal.id, replacementJournalEntryId: existing.journalEntry.id };
}

export async function correctPostedTransaction(client: Client, actor: ManualTransactionActor, input: unknown): Promise<TransactionCorrectionResult> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN", message: "Only business owners can correct posted transactions." };
  const parsed = transactionCorrectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0]?.message ?? "Correction input is invalid." };
  const data = parsed.data;
  const entryDate = parseTransactionDate(data.transactionDate)!;
  const prismaClient = client as PrismaClient;
  const prior = await replay(prismaClient, actor, data.correctionKey, data.transactionId);
  if (prior) return prior;

  try {
    return await client.$transaction(async (tx) => {
      const original = await tx.transaction.findFirst({
        where: { id: data.transactionId, businessId: actor.businessId },
        select: {
          id: true, accountId: true, status: true, version: true, correctionOfId: true,
          corrections: { select: { id: true } },
          journalEntry: {
            select: {
              id: true, entryNumber: true, status: true, sourceType: true,
              lines: { select: { ledgerAccountId: true, debitAmount: true, creditAmount: true, memo: true, lineNumber: true } },
              reversedByEntries: { select: { id: true } },
            },
          },
        },
      });
      if (!original) return { ok: false, code: "NOT_FOUND", message: "That transaction is unavailable." };
      if (original.version !== data.expectedVersion) return { ok: false, code: "CONFLICT", message: "This transaction changed before the correction was saved. Refresh and try again." };
      if (original.correctionOfId || original.status === "CORRECTED" || original.corrections.length || !original.journalEntry || original.journalEntry.status !== "POSTED" || original.journalEntry.sourceType === "REVERSING_ENTRY" || original.journalEntry.reversedByEntries.length)
        return { ok: false, code: "CONFLICT", message: "This transaction is not eligible for correction." };
      if (original.status !== "APPROVED" && original.status !== "EXCLUDED") return { ok: false, code: "CONFLICT", message: "Only posted reviewed transactions can be corrected." };
      const originalDebit = original.journalEntry.lines.reduce((total, line) => total.plus(line.debitAmount), new Prisma.Decimal(0));
      const originalCredit = original.journalEntry.lines.reduce((total, line) => total.plus(line.creditAmount), new Prisma.Decimal(0));
      if (originalDebit.equals(0) || !originalDebit.equals(originalCredit)) return { ok: false, code: "INVALID", message: "This transaction does not have a balanced journal." };
      const [period, account] = await Promise.all([
        tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: entryDate }, endsAt: { gte: entryDate } }, select: { id: true } }),
        tx.financialAccount.findFirst({
          where: { id: original.accountId, businessId: actor.businessId, ownership: "BUSINESS", isActive: true },
          select: { id: true, ledgerAccount: { select: { id: true, type: true, isActive: true } } },
        }),
      ]);
      if (!period) return { ok: false, code: "NO_OPEN_PERIOD", message: "The correction date must belong to an open accounting period." };
      if (!account?.ledgerAccount || account.ledgerAccount.type !== "ASSET" || !account.ledgerAccount.isActive) return { ok: false, code: "NOT_FOUND", message: "The original business cash account is unavailable." };
      const accounting = accountingForManualTransaction(data);
      const category = data.categoryAccountId ? await tx.ledgerAccount.findFirst({ where: { id: data.categoryAccountId, businessId: actor.businessId, isActive: true, type: accounting.categoryType, financialAccountId: null }, select: { id: true } }) : null;
      if ((data.transactionType === "INCOME" || data.transactionType === "BUSINESS_EXPENSE" || data.transactionType === "MIXED") && !category) return { ok: false, code: "NOT_FOUND", message: "Choose an active business category." };
      const equity = data.transactionType === "PERSONAL" || data.transactionType === "MIXED" ? await tx.ledgerAccount.findMany({ where: { businessId: actor.businessId, isActive: true, type: "EQUITY", subtype: { in: ["OWNER_CONTRIBUTION", "OWNER_DISTRIBUTION"] } }, select: { id: true, subtype: true } }) : [];
      const contributions = equity.find((item) => item.subtype === "OWNER_CONTRIBUTION")?.id ?? null;
      const distributions = equity.find((item) => item.subtype === "OWNER_DISTRIBUTION")?.id ?? null;
      if ((data.transactionType === "PERSONAL" || data.transactionType === "MIXED") && (!contributions || !distributions)) return { ok: false, code: "NOT_FOUND", message: "The approved owner-equity accounts are unavailable." };
      const gate = await tx.transaction.updateMany({ where: { id: original.id, businessId: actor.businessId, version: data.expectedVersion, status: { in: ["APPROVED", "EXCLUDED"] } }, data: { status: "CORRECTED", correctionReason: data.correctionReason, version: { increment: 1 } } });
      if (gate.count !== 1) return { ok: false, code: "CONFLICT", message: "This transaction changed before the correction was saved. Refresh and try again." };
      const reversal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `COR-REV-${original.journalEntry.entryNumber}-${data.expectedVersion + 1}`, entryDate, description: `Correction reversal: ${data.correctionReason}`, status: "DRAFT", sourceType: "REVERSING_ENTRY", sourceEntityId: original.id, reversalOfEntryId: original.journalEntry.id } });
      await tx.journalLine.createMany({ data: original.journalEntry.lines.map((line, index) => ({ businessId: actor.businessId, journalEntryId: reversal.id, ledgerAccountId: line.ledgerAccountId, lineNumber: index + 1, debitAmount: line.creditAmount, creditAmount: line.debitAmount, memo: line.memo ? `Correction reversal: ${line.memo}` : "Correction reversal" })) });
      await tx.journalEntry.update({ where: { id: reversal.id }, data: { status: "POSTED", postedAt: new Date() } });
      const replacement = await tx.transaction.create({ data: { businessId: actor.businessId, accountId: account.id, postedAt: entryDate, description: data.description!, merchantName: data.merchantOrPayer, amount: data.amount, direction: accounting.direction, intent: accounting.intent, status: accounting.status, sourceReference: data.reference, notes: data.notes, approvedAt: new Date(), approvedByMembershipId: actor.actorUserId, correctionKey: data.correctionKey, correctionReason: data.correctionReason, correctionOfId: original.id } });
      if (data.transactionType === "MIXED") await tx.transactionSplit.createMany({ data: [{ businessId: actor.businessId, transactionId: replacement.id, intent: "BUSINESS", amount: data.businessAmount!, memo: "Corrected business portion" }, { businessId: actor.businessId, transactionId: replacement.id, intent: "PERSONAL", amount: data.personalAmount!, memo: "Corrected personal portion" }] });
      const replacementJournal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `COR-${replacement.id}`, entryDate, description: `Correction replacement: ${data.description!}`, status: "DRAFT", sourceType: "MANUAL", sourceEntityId: replacement.id, transactionId: replacement.id } });
      await tx.journalLine.createMany({ data: correctionJournalLines(data, { cashAccountId: account.ledgerAccount.id, categoryAccountId: category?.id ?? null, contributionsAccountId: contributions, distributionsAccountId: distributions }).map((line, index) => ({ ...line, businessId: actor.businessId, journalEntryId: replacementJournal.id, lineNumber: index + 1 })) });
      await tx.journalEntry.update({ where: { id: replacementJournal.id }, data: { status: "POSTED", postedAt: new Date() } });
      await tx.transaction.update({ where: { id: original.id }, data: { correctionReversalJournalId: reversal.id } });
      await tx.auditEvent.createMany({ data: [
        { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "SUPERSEDE", entityType: "Transaction", entityId: original.id, reason: data.correctionReason, beforeJson: { status: original.status, version: original.version, journalEntryId: original.journalEntry.id }, afterJson: { status: "CORRECTED", version: original.version + 1, reversalJournalEntryId: reversal.id, replacementTransactionId: replacement.id }, metadataJson: { executionMode: actor.executionMode, correction: true } },
        { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "JournalEntry", entityId: reversal.id, reason: data.correctionReason, afterJson: { reversalOfEntryId: original.journalEntry.id, status: "POSTED" }, metadataJson: { executionMode: actor.executionMode, correctionReversal: true } },
        { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "Transaction", entityId: replacement.id, reason: data.correctionReason, afterJson: { correctionOfTransactionId: original.id, journalEntryId: replacementJournal.id, status: accounting.status }, metadataJson: { executionMode: actor.executionMode, correctionReplacement: true } },
      ] });
      return { ok: true, code: "CORRECTED", transactionId: replacement.id, reversalJournalEntryId: reversal.id, replacementJournalEntryId: replacementJournal.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await replay(prismaClient, actor, data.correctionKey, data.transactionId);
      if (concurrent) return concurrent;
    }
    return { ok: false, code: "SAFE_FAILURE", message: "The transaction could not be corrected safely. Refresh and try again." };
  }
}
