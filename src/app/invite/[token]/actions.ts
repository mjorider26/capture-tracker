"use server";

import { redirect } from "next/navigation";

import { acceptOperatorInvitation } from "@/lib/auth/operator-invitations";
import { requireAuthenticatedSession } from "@/lib/auth/operator-authorization";

export async function acceptInvitationAction(form: FormData) {
  const token = String(form.get("token") ?? "");
  try {
    const session = await requireAuthenticatedSession();
    await acceptOperatorInvitation({ token, userId: session.userId, email: session.email });
  } catch {
    redirect(`/invite/${encodeURIComponent(token)}?error=acceptance`);
  }
  redirect("/app/onboarding");
}
