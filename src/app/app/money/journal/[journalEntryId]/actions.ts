"use server";
import { revalidatePath } from "next/cache";
import { reverseJournalFromForm } from "@/lib/services/journal-reversal-action";
import type { AccountingActionState } from "@/lib/services/reconciliation-action";
import { requireBusinessMutationContext as requireBusinessContext } from "@/lib/security/business-context";
export async function reverseAuthenticatedJournal(_state: AccountingActionState, form: FormData) { try { const context = await requireBusinessContext(); const result = await reverseJournalFromForm({ businessId: context.business.id, actorUserId: context.user.id, actorMembershipId: context.membership.id, role: context.membership.role, executionMode: "authenticated" }, form); if (result.status === "success") { revalidatePath("/app/money/journal"); revalidatePath("/app/money"); revalidatePath("/app/activity"); } return result; } catch { return { status: "error" as const, message: "Your reversal could not be authorized." }; } }
