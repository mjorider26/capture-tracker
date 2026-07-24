import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { invertJournalLines, journalReversalSchema } from "./journal-reversal-core";
import type { ReconciliationActor } from "./reconciliation-core";

type Client = Pick<PrismaClient, "$transaction">;
export type JournalReversalResult = { ok: true; reversalEntryId: string; nextVersion: number } | { ok: false; code: "INVALID" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "NO_OPEN_PERIOD"; message: string };

export async function reverseJournalEntry(client: Client, actor: ReconciliationActor, input: unknown): Promise<JournalReversalResult> {
  if (actor.role !== "OWNER") return { ok: false, code: "FORBIDDEN", message: "Only business owners can reverse posted entries." };
  const parsed = journalReversalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: parsed.error.issues[0]?.message ?? "Reversal input is invalid." };
  const reversalDate = new Date(`${parsed.data.reversalDate}T12:00:00.000Z`);
  try { return await client.$transaction(async (tx) => {
    const original = await tx.journalEntry.findFirst({ where: { id: parsed.data.journalEntryId, businessId: actor.businessId }, include: { lines: { orderBy: { lineNumber: "asc" } }, reversedByEntries: { select: { id: true } } } });
    if (!original) return { ok: false, code: "NOT_FOUND", message: "Journal entry not found." };
    if (original.version !== parsed.data.expectedVersion) return { ok: false, code: "CONFLICT", message: "This journal entry changed. Refresh and try again." };
    if (original.status !== "POSTED" || original.sourceType === "REVERSING_ENTRY" || original.reversedByEntries.length) return { ok: false, code: "CONFLICT", message: "This entry is not eligible for reversal." };
    if (!original.lines.length) return { ok: false, code: "INVALID", message: "A journal entry without lines cannot be reversed." };
    const debit = original.lines.reduce((sum, line) => sum.plus(line.debitAmount), new Prisma.Decimal(0));
    const credit = original.lines.reduce((sum, line) => sum.plus(line.creditAmount), new Prisma.Decimal(0));
    if (debit.equals(0) || !debit.equals(credit)) return { ok: false, code: "INVALID", message: "Only balanced posted entries can be reversed." };
    const period = await tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: reversalDate }, endsAt: { gte: reversalDate } }, select: { id: true } });
    if (!period) return { ok: false, code: "NO_OPEN_PERIOD", message: "The reversal date must belong to an open accounting period." };
    // The versioned conditional update is the application concurrency gate; the unique reversal relation is its database backstop.
    const gate = await tx.journalEntry.updateMany({ where: { id: original.id, businessId: actor.businessId, status: "POSTED", version: parsed.data.expectedVersion }, data: { version: { increment: 1 } } });
    if (gate.count !== 1) return { ok: false, code: "CONFLICT", message: "This journal entry changed. Refresh and try again." };
    const reversal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `REV-${original.entryNumber}-${original.version + 1}`, entryDate: reversalDate, description: `Reversal of ${original.entryNumber}: ${parsed.data.reason}`, status: "DRAFT", sourceType: "REVERSING_ENTRY", sourceEntityId: original.id, reversalOfEntryId: original.id } });
    await tx.journalLine.createMany({ data: invertJournalLines(original.lines).map((line) => ({ ...line, businessId: actor.businessId, journalEntryId: reversal.id })) });
    await tx.journalEntry.update({ where: { id: reversal.id }, data: { status: "POSTED", postedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "JournalEntry", entityId: reversal.id, beforeJson: { originalEntryId: original.id, originalVersion: original.version }, afterJson: { reversalOfEntryId: original.id, status: "POSTED", version: reversal.version }, metadataJson: { executionMode: actor.executionMode, reversal: true, reason: parsed.data.reason, reversalDate: parsed.data.reversalDate, debitTotal: debit.toFixed(2), creditTotal: credit.toFixed(2) } } });
    return { ok: true, reversalEntryId: reversal.id, nextVersion: original.version + 1 };
  }); } catch { return { ok: false, code: "INVALID", message: "The journal reversal could not be posted safely." }; }
}
