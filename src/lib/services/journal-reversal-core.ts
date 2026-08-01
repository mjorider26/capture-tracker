import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const version = z.string().regex(/^(?:[1-9]\d{0,8})$/).transform(Number);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)), "Use a valid reversal date.");

export const journalReversalSchema = z.object({
  journalEntryId: id,
  expectedVersion: version,
  reversalDate: date,
  reason: z.string().trim().min(1, "A business reason is required.").max(240).refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Reason contains unsupported characters."),
  confirmed: z.literal("on", { error: "Confirm the immutable reversal before posting." }),
});

export function invertJournalLines(lines: Array<{ debitAmount: { toFixed: (digits: number) => string }; creditAmount: { toFixed: (digits: number) => string }; ledgerAccountId: string; memo: string | null }>) {
  return lines.map((line, index) => ({ ledgerAccountId: line.ledgerAccountId, lineNumber: index + 1, debitAmount: line.creditAmount.toFixed(2), creditAmount: line.debitAmount.toFixed(2), memo: line.memo }));
}
