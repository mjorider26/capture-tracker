"use server";
import { revalidatePath } from "next/cache";
import { requireBusinessMutationContext as requireBusinessContext } from "@/lib/security/business-context";
import { saveSettings } from "@/lib/services/pilot-readiness";
export async function saveSettingsAction(_: { ok: boolean; message?: string }, form: FormData) {
  try {
    const c = await requireBusinessContext(); const result = await saveSettings({ businessId: c.business.id, actorUserId: c.user.id }, form);
    if (result === "SAVED") { revalidatePath("/app/settings"); revalidatePath("/app/activity"); return { ok: true, message: "Settings saved with immutable change history." }; }
    if (result === "UNCHANGED") return { ok: true, message: "Those settings are already saved." };
    return { ok: false, message: result === "STALE" ? "Settings changed elsewhere. Refresh and try again." : "Settings values are invalid." };
  } catch { return { ok: false, message: "Settings could not be authorized." }; }
}
