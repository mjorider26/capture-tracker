"use server";

import { revalidatePath } from "next/cache";

import { createOperatorInvitation, expireOperatorInvitation, revokeOperatorInvitation } from "@/lib/auth/operator-invitations";
import { requireOperatorSession } from "@/lib/auth/operator-authorization";
import { canonicalAppBaseUrl } from "@/lib/app-url";

type State = { ok: boolean; message?: string; invitationUrl?: string };
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function createInvitationAction(_: State, form: FormData): Promise<State> {
  try {
    const actor = await requireOperatorSession();
    const result = await createOperatorInvitation(actor, { invitedEmail: text(form, "invitedEmail"), ownerDisplayName: text(form, "ownerDisplayName"), businessLegalName: text(form, "businessLegalName"), businessDisplayName: text(form, "businessDisplayName"), foundingCustomer: form.get("foundingCustomer") === "on" }, canonicalAppBaseUrl());
    revalidatePath("/operator/onboarding");
    return { ok: true, message: "Invitation created. Transactional email is not configured, so copy the link and send it manually.", invitationUrl: result.invitationUrl };
  } catch { return { ok: false, message: "Invitation could not be created." }; }
}

export async function revokeInvitationAction(_: State, form: FormData): Promise<State> {
  try { await revokeOperatorInvitation(await requireOperatorSession(), text(form, "invitationId")); revalidatePath("/operator/onboarding"); return { ok: true, message: "Invitation revoked." }; } catch { return { ok: false, message: "Invitation could not be changed." }; }
}

export async function expireInvitationAction(_: State, form: FormData): Promise<State> {
  try { await expireOperatorInvitation(await requireOperatorSession(), text(form, "invitationId")); revalidatePath("/operator/onboarding"); return { ok: true, message: "Invitation expired." }; } catch { return { ok: false, message: "Invitation could not be changed." }; }
}
