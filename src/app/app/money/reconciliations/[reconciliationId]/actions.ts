"use server";
import { revalidatePath } from "next/cache";
import { finalizeReconciliationFromForm, saveReconciliationFromForm, type AccountingActionState } from "@/lib/services/reconciliation-action";
import { requireBusinessContext } from "@/lib/security/business-context";
const actor = async () => { const context = await requireBusinessContext(); return { businessId: context.business.id, actorUserId: context.user.id, actorMembershipId: context.membership.id, role: context.membership.role, executionMode: "authenticated" as const }; };
export async function saveAuthenticatedReconciliation(_state: AccountingActionState, form: FormData) { try { const result = await saveReconciliationFromForm(await actor(), form); if (result.status === "success") revalidatePath("/app/money/reconciliations"); return result; } catch { return { status: "error" as const, message: "Your reconciliation could not be authorized." }; } }
export async function finalizeAuthenticatedReconciliation(_state: AccountingActionState, form: FormData) { try { const result = await finalizeReconciliationFromForm(await actor(), form); if (result.status === "success") revalidatePath("/app/money/reconciliations"); return result; } catch { return { status: "error" as const, message: "Your reconciliation could not be authorized." }; } }
