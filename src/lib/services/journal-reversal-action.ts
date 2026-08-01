import "server-only";
import { prisma } from "../prisma";
import { reverseJournalEntry } from "./journal-reversal";
import type { ReconciliationActor } from "./reconciliation-core";
import type { AccountingActionState } from "./reconciliation-action";
export async function reverseJournalFromForm(actor: ReconciliationActor, formData: FormData): Promise<AccountingActionState> { const result = await reverseJournalEntry(prisma, actor, { journalEntryId: formData.get("journalEntryId"), expectedVersion: formData.get("expectedVersion"), reversalDate: formData.get("reversalDate"), reason: formData.get("reason"), confirmed: formData.get("confirmed") }); return result.ok ? { status: "success", message: "Posted reversal created; the original entry remains unchanged." } : { status: result.code === "CONFLICT" ? "conflict" : "error", message: result.message }; }
