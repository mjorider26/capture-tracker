"use server";
import { revalidatePath } from "next/cache";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { saveSettings } from "@/lib/services/pilot-readiness";
export async function saveDemoSettings(_: { ok: boolean; message?: string }, form: FormData) {
  const context = await resolveLocalDemoContext(); if (!context) return { ok: false, message: "Local demo settings are unavailable." };
  const result = await saveSettings({ businessId: context.businessId, actorUserId: context.userId }, form);
  if (result === "SAVED") { revalidatePath("/demo/settings"); revalidatePath("/demo/activity"); return { ok: true, message: "Settings saved with immutable change history." }; }
  if (result === "UNCHANGED") return { ok: true, message: "Those settings are already saved." };
  return { ok: false, message: result === "STALE" ? "Settings changed elsewhere. Refresh and try again." : "Settings values are invalid." };
}
