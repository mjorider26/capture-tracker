"use server";
import { revalidatePath } from "next/cache";
import { finalizeReconciliationFromForm, saveReconciliationFromForm, type AccountingActionState } from "@/lib/services/reconciliation-action";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
const actor = async () => { const context = await resolveLocalDemoContext(); return context ? { businessId: context.businessId, actorUserId: context.userId, actorMembershipId: context.membershipId, role: context.role, executionMode: "demo" as const } : null; };
export async function saveDemoReconciliation(_state: AccountingActionState, form: FormData) { const context = await actor(); if (!context) return { status: "error" as const, message: "Local demo reconciliation is unavailable." }; const result = await saveReconciliationFromForm(context, form); if (result.status === "success") revalidatePath("/demo/money/reconciliations"); return result; }
export async function finalizeDemoReconciliation(_state: AccountingActionState, form: FormData) { const context = await actor(); if (!context) return { status: "error" as const, message: "Local demo reconciliation is unavailable." }; const result = await finalizeReconciliationFromForm(context, form); if (result.status === "success") revalidatePath("/demo/money/reconciliations"); return result; }
