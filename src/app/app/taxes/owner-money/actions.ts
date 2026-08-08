"use server";
import { revalidatePath } from "next/cache";
import type { OwnerMoneyActionState } from "@/components/owner-money-experience";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";
import { createPersonallyPaidReimbursement } from "@/lib/services/reimbursement";
export async function createAuthenticatedReimbursement(_previous: OwnerMoneyActionState, formData: FormData): Promise<OwnerMoneyActionState> {
  try { const context = await requireBusinessContext(); const result = await createPersonallyPaidReimbursement(prisma, { businessId: context.business.id, actorUserId: context.user.id, actorMembershipId: context.membership.id, role: context.membership.role, executionMode: "authenticated" }, Object.fromEntries(formData)); if (!result.ok) return { status: "error", message: result.message }; revalidatePath("/app/taxes/owner-money"); revalidatePath("/app/today"); revalidatePath("/app/review"); return { status: "success", message: result.code === "CREATED" ? "Reimbursement claim created for controlled review." : "This reimbursement claim was already recorded." }; } catch { return { status: "error", message: "The reimbursement could not be recorded safely. Refresh and try again." }; }
}
