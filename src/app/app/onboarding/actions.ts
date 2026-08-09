"use server";

import { revalidatePath } from "next/cache";

import { requireBusinessMutationContext as requireBusinessContext } from "@/lib/security/business-context";
import { saveClientCutover } from "@/lib/services/client-cutover";

export async function saveOnboardingAction(_: { ok: boolean; message: string }, form: FormData) {
  try {
    const context = await requireBusinessContext();
    const result = await saveClientCutover({ businessId: context.business.id, actorUserId: context.user.id, membershipId: context.membership.id }, form);
    if (result.ok) { revalidatePath("/app/onboarding"); revalidatePath("/app/today"); revalidatePath("/app/money/reconciliations"); }
    return result;
  } catch { return { ok: false, message: "Setup could not be authorized." }; }
}
