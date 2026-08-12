"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessMutationContext as requireBusinessContext } from "@/lib/security/business-context";
import { mapConnectedFinancialAccount, setConnectedFinancialAccountSelection, setFinancialAccountBankFeedMethod } from "@/lib/services/bank-sync";
import { completePlaidReconnect, createPlaidLinkToken, disconnectPlaidConnection, exchangePlaidPublicToken, syncPlaidBankConnection } from "@/lib/services/plaid-bank";

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

const actorFrom = (context: Awaited<ReturnType<typeof requireBusinessContext>>) => ({ businessId: context.business.id, actorUserId: context.user.id, role: context.membership.role });
const refreshBankPaths = () => { revalidatePath("/app/money/bank"); revalidatePath("/app/money/import"); revalidatePath("/app/today"); revalidatePath("/app/review"); };

export async function chooseBankFeedMethodAction(_: BankConnectionActionState, form: FormData): Promise<BankConnectionActionState> {
  try {
    const context = await requireBusinessContext();
    const method = String(form.get("method") ?? "");
    if (method !== "MANUAL" && method !== "PLAID") return { ok: false, message: "Choose Plaid or manual CSV import." };
    const result = await setFinancialAccountBankFeedMethod(actorFrom(context), { financialAccountId: String(form.get("financialAccountId") ?? ""), method });
    if (!result.ok) return result;
    refreshBankPaths();
    return { ok: true, message: method === "PLAID" ? "Plaid selected for this account. Connect and map the bank account below." : "Manual CSV selected. Existing connection history was preserved." };
  } catch { return { ok: false, message: "The account method could not be authorized." }; }
}

export async function selectPlaidAccountAction(_: BankConnectionActionState, form: FormData): Promise<BankConnectionActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await setConnectedFinancialAccountSelection(actorFrom(context), { connectedAccountId: String(form.get("connectedAccountId") ?? ""), selected: String(form.get("selected") ?? "") === "true" });
    if (!result.ok) return result;
    refreshBankPaths();
    return { ok: true, message: "Plaid account selection updated. The institution Item remains connected." };
  } catch { return { ok: false, message: "The account selection could not be authorized." }; }
}

export async function syncPlaidConnectionAction(_: BankConnectionActionState, form: FormData): Promise<BankConnectionActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await syncPlaidBankConnection(actorFrom(context), String(form.get("connectionId") ?? ""));
    refreshBankPaths();
    return result.ok ? { ok: true, message: `Sync complete: ${result.imported} new, ${result.updated} updated, ${result.removed} removed, ${result.duplicates} duplicate.` } : result;
  } catch { return { ok: false, message: "The Plaid sync could not be authorized." }; }
}

export async function disconnectPlaidConnectionAction(_: BankConnectionActionState, form: FormData): Promise<BankConnectionActionState> {
  if (String(form.get("confirmation") ?? "") !== "DISCONNECT") return { ok: false, message: "Confirm that you want to disconnect this Plaid Item." };
  try {
    const context = await requireBusinessContext();
    const result = await disconnectPlaidConnection(actorFrom(context), String(form.get("connectionId") ?? ""));
    if (!result.ok) return result;
    refreshBankPaths();
    return { ok: true, message: "Plaid disconnected. Imported and posted history was preserved; affected accounts now use manual CSV." };
  } catch { return { ok: false, message: "The disconnect request could not be authorized." }; }
}

export async function createPlaidLinkTokenAction(connectionId?: string) {
  try { const context = await requireBusinessContext(); return createPlaidLinkToken(actorFrom(context), connectionId); }
  catch { return { ok: false as const, message: "The bank connection could not be authorized." }; }
}

export async function exchangePlaidPublicTokenAction(publicToken: string) {
  try { const context = await requireBusinessContext(); const result = await exchangePlaidPublicToken(actorFrom(context), publicToken); if (result.ok) refreshBankPaths(); return result; }
  catch { return { ok: false as const, message: "The bank connection could not be authorized." }; }
}

export async function completePlaidReconnectAction(connectionId: string) {
  try { const context = await requireBusinessContext(); const result = await completePlaidReconnect(actorFrom(context), connectionId); refreshBankPaths(); return result; }
  catch { return { ok: false as const, message: "The reconnect could not be authorized." }; }
}
