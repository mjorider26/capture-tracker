import { Prisma, type PrismaClient } from "../../generated/prisma/client";

import {
  accountingForManualTransaction,
  manualJournalLines,
  manualTransactionSchema,
  parseTransactionDate,
  type ManualTransactionActor,
} from "./manual-transaction-core";

type Client = Pick<PrismaClient, "$transaction">;

export type ManualTransactionResult =
  | { ok: true; code: "CREATED" | "ALREADY_CREATED"; transactionId: string; journalEntryId: string }
  | { ok: false; code: "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "NO_OPEN_PERIOD" | "IDEMPOTENCY_CONFLICT" | "SAFE_FAILURE"; message: string };

function sameSubmission(existing: { amount: Prisma.Decimal; postedAt: Date; description: string; merchantName: string | null; sourceReference: string | null; notes: string | null }, data: { amount: string; transactionDate: string; description: string | null; merchantOrPayer: string | null; reference: string | null; notes: string | null }) {
  return existing.amount.equals(data.amount) && existing.postedAt.toISOString().slice(0, 10) === data.transactionDate && existing.description === data.description && existing.merchantName === data.merchantOrPayer && existing.sourceReference === data.reference && existing.notes === data.notes;
}

async function idempotencyReplay(client: PrismaClient, actor: ManualTransactionActor, data: { idempotencyKey: string; amount: string; transactionDate: string; description: string | null; merchantOrPayer: string | null; reference: string | null; notes: string | null }): Promise<ManualTransactionResult | null> {
  const existing = await client.transaction.findFirst({
    where: { businessId: actor.businessId, manualEntryKey: data.idempotencyKey },
    select: { id: true, amount: true, postedAt: true, description: true, merchantName: true, sourceReference: true, notes: true, journalEntry: { select: { id: true } } },
  });
  if (!existing) return null;
  if (!sameSubmission(existing, data) || !existing.journalEntry) return { ok: false, code: "IDEMPOTENCY_CONFLICT", message: "This transaction intent key was already used with different facts." };
  return { ok: true, code: "ALREADY_CREATED", transactionId: existing.id, journalEntryId: existing.journalEntry.id };
}

export async function createManualTransaction(client: Client, actor: ManualTransactionActor, input: unknown): Promise<ManualTransactionResult> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN", message: "Only business owners can add transactions." };
  const parsed = manualTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0]?.message ?? "Transaction input is invalid." };
  const data = parsed.data;
  const entryDate = parseTransactionDate(data.transactionDate)!;
  const accounting = accountingForManualTransaction(data);
  const prismaClient = client as PrismaClient;
  const replay = await idempotencyReplay(prismaClient, actor, data);
  if (replay) return replay;

  try {
    return await client.$transaction(async (tx) => {
      const account = await tx.financialAccount.findFirst({
        where: { id: data.financialAccountId, businessId: actor.businessId, isActive: true, ownership: "BUSINESS" },
        select: { id: true, ledgerAccount: { select: { id: true, type: true, isActive: true } } },
      });
      if (!account?.ledgerAccount || account.ledgerAccount.type !== "ASSET" || !account.ledgerAccount.isActive)
        return { ok: false, code: "NOT_FOUND", message: "Choose an active business cash account." };
      const period = await tx.accountingPeriod.findFirst({
        where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: entryDate }, endsAt: { gte: entryDate } },
        select: { id: true },
      });
      if (!period) return { ok: false, code: "NO_OPEN_PERIOD", message: "The transaction date must belong to an open accounting period." };
      const category = data.categoryAccountId ? await tx.ledgerAccount.findFirst({
        where: { id: data.categoryAccountId, businessId: actor.businessId, isActive: true, type: accounting.categoryType, financialAccountId: null },
        select: { id: true },
      }) : null;
      if ((data.transactionType === "INCOME" || data.transactionType === "BUSINESS_EXPENSE" || data.transactionType === "MIXED") && !category)
        return { ok: false, code: "NOT_FOUND", message: `Choose an active ${accounting.categoryType.toLowerCase()} category.` };
      const equity = data.transactionType === "PERSONAL" || data.transactionType === "MIXED" ? await tx.ledgerAccount.findMany({
        where: { businessId: actor.businessId, isActive: true, type: "EQUITY", subtype: { in: ["OWNER_CONTRIBUTION", "OWNER_DISTRIBUTION"] } },
        select: { id: true, subtype: true },
      }) : [];
      const contributions = equity.find((item) => item.subtype === "OWNER_CONTRIBUTION")?.id ?? null;
      const distributions = equity.find((item) => item.subtype === "OWNER_DISTRIBUTION")?.id ?? null;
      if ((data.transactionType === "PERSONAL" || data.transactionType === "MIXED") && (!contributions || !distributions))
        return { ok: false, code: "NOT_FOUND", message: "The approved owner-equity accounts are unavailable." };

      const transaction = await tx.transaction.create({
        data: {
          businessId: actor.businessId,
          accountId: account.id,
          postedAt: entryDate,
          description: data.description!,
          merchantName: data.merchantOrPayer,
          amount: data.amount,
          direction: accounting.direction,
          intent: accounting.intent,
          status: accounting.status,
          sourceReference: data.reference,
          manualEntryKey: data.idempotencyKey,
          notes: data.notes,
          approvedAt: new Date(),
          approvedByMembershipId: actor.actorUserId,
        },
      });
      if (data.transactionType === "MIXED") await tx.transactionSplit.createMany({
        data: [
          { businessId: actor.businessId, transactionId: transaction.id, intent: "BUSINESS", amount: data.businessAmount!, memo: "Manual business portion" },
          { businessId: actor.businessId, transactionId: transaction.id, intent: "PERSONAL", amount: data.personalAmount!, memo: "Manual personal portion" },
        ],
      });
      const journal = await tx.journalEntry.create({
        data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `MAN-${transaction.id}`, entryDate, description: data.description!, status: "DRAFT", sourceType: "MANUAL", sourceEntityId: transaction.id, transactionId: transaction.id },
      });
      await tx.journalLine.createMany({
        data: manualJournalLines({ total: new Prisma.Decimal(data.amount).toFixed(2), transactionType: data.transactionType, direction: accounting.direction, cashAccountId: account.ledgerAccount.id, categoryAccountId: category?.id ?? null, contributionsAccountId: contributions, distributionsAccountId: distributions, businessAmount: data.businessAmount ? new Prisma.Decimal(data.businessAmount).toFixed(2) : null, personalAmount: data.personalAmount ? new Prisma.Decimal(data.personalAmount).toFixed(2) : null }).map((line, index) => ({ ...line, businessId: actor.businessId, journalEntryId: journal.id, lineNumber: index + 1 })),
      });
      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
      await tx.auditEvent.create({
        data: {
          actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "Transaction", entityId: transaction.id,
          afterJson: { transactionType: data.transactionType, amount: new Prisma.Decimal(data.amount).toFixed(2), date: data.transactionDate, classification: accounting.intent, categoryAccountId: category?.id ?? null, journalEntryId: journal.id },
          metadataJson: { executionMode: actor.executionMode, manualTransaction: true, idempotencyKey: data.idempotencyKey, journalEntryId: journal.id },
        },
      });
      return { ok: true, code: "CREATED", transactionId: transaction.id, journalEntryId: journal.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentReplay = await idempotencyReplay(prismaClient, actor, data);
      if (concurrentReplay) return concurrentReplay;
    }
    return { ok: false, code: "SAFE_FAILURE", message: "The transaction could not be saved safely. Refresh and try again." };
  }
}
