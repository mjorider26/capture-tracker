"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/security/business-context";
import { mapConnectedFinancialAccount } from "@/lib/services/bank-sync";

export type BankConnectionActionState = { ok: boolean; message?: string };

export async function mapBankAccountAction(_: BankConnectionActionState, form: FormData): Promise<BankConnectionActionState> {
  try {
    const context = await requireBusinessContext();
    const financialAccountId = String(form.get("financialAccountId") ?? "");
    const result = await mapConnectedFinancialAccount({ businessId: context.business.id, actorUserId: context.user.id, role: context.membership.role }, { connectedAccountId: String(form.get("connectedAccountId") ?? ""), financialAccountId: financialAccountId || null });
    if (!result.ok) return result;
    revalidatePath("/app/money/bank");
    return { ok: true, message: "Account mapping saved. Connected activity remains evidence until you review and post it." };
  } catch { return { ok: false, message: "The account mapping could not be authorized." }; }
}
