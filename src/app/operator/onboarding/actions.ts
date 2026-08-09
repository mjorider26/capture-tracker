"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createOperatorInvitation, expireOperatorInvitation, revokeOperatorInvitation } from "@/lib/auth/operator-invitations";
import { requireOperatorSession } from "@/lib/auth/operator-authorization";

type State = { ok: boolean; message?: string; invitationUrl?: string };
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function createInvitationAction(_: State, form: FormData): Promise<State> {
  try {
    const actor = await requireOperatorSession();
    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin") ?? process.env.BETTER_AUTH_URL;
    if (!origin) return { ok: false, message: "Invitation could not be created." };
    const result = await createOperatorInvitation(actor, { invitedEmail: text(form, "invitedEmail"), ownerDisplayName: text(form, "ownerDisplayName"), businessLegalName: text(form, "businessLegalName"), businessDisplayName: text(form, "businessDisplayName") }, origin);
    revalidatePath("/operator/onboarding");
    return { ok: true, message: "Invitation created. Copy the link now and send it manually.", invitationUrl: result.invitationUrl };
  } catch { return { ok: false, message: "Invitation could not be created." }; }
}

export async function revokeInvitationAction(_: State, form: FormData): Promise<State> {
  try { await revokeOperatorInvitation(await requireOperatorSession(), text(form, "invitationId")); revalidatePath("/operator/onboarding"); return { ok: true, message: "Invitation revoked." }; } catch { return { ok: false, message: "Invitation could not be changed." }; }
}

export async function expireInvitationAction(_: State, form: FormData): Promise<State> {
  try { await expireOperatorInvitation(await requireOperatorSession(), text(form, "invitationId")); revalidatePath("/operator/onboarding"); return { ok: true, message: "Invitation expired." }; } catch { return { ok: false, message: "Invitation could not be changed." }; }
}
