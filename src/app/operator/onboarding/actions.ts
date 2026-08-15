"use server";

import { revalidatePath } from "next/cache";

import {
  createOperatorInvitation,
  expireOperatorInvitation,
  InvitationError,
  reissueOperatorInvitation,
  revokeOperatorInvitation,
} from "@/lib/auth/operator-invitations";
import { requireOperatorSession } from "@/lib/auth/operator-authorization";
import { canonicalAppBaseUrl } from "@/lib/app-url";

export type InvitationActionState = {
  ok: boolean;
  message?: string;
  invitationUrl?: string;
  invitationId?: string;
  emailDeliveryStatus?: string;
  ownerDisplayName?: string;
  invitedEmail?: string;
  businessDisplayName?: string;
  expiresAt?: string;
};
const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function createInvitationAction(
  _: InvitationActionState,
  form: FormData,
): Promise<InvitationActionState> {
  try {
    const actor = await requireOperatorSession();
    const deliveryMode =
      text(form, "deliveryMode") === "manual" ? "MANUAL" : "EMAIL";
    const result = await createOperatorInvitation(
      actor,
      {
        invitedEmail: text(form, "invitedEmail"),
        ownerDisplayName: text(form, "ownerDisplayName"),
        businessLegalName: text(form, "businessLegalName"),
        businessDisplayName: text(form, "businessDisplayName"),
        foundingCustomer: form.get("foundingCustomer") === "on",
      },
      canonicalAppBaseUrl(),
      undefined,
      { deliveryMode },
    );
    revalidatePath("/operator/onboarding");
    const message =
      result.emailDeliveryStatus === "SENT"
        ? "Invitation sent."
        : result.emailDeliveryStatus === "MANUAL_REQUIRED"
          ? "Secure invitation link created."
          : "Invitation created, but email couldn't be sent.";
    return actionResult(result, message);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof InvitationError && error.code === "CONFLICT"
          ? "An unused invitation already exists for this email. Revoke it or use Send again."
          : "Invitation could not be created.",
    };
  }
}

export async function reissueInvitationAction(
  _: InvitationActionState,
  form: FormData,
): Promise<InvitationActionState> {
  try {
    const result = await reissueOperatorInvitation(
      await requireOperatorSession(),
      text(form, "invitationId"),
      canonicalAppBaseUrl(),
    );
    revalidatePath("/operator/onboarding");
    return actionResult(
      result,
      result.emailDeliveryStatus === "SENT"
        ? "Replacement invitation sent. The previous link is revoked."
        : "Replacement invitation created, but email couldn't be sent. The previous link is revoked.",
    );
  } catch {
    return {
      ok: false,
      message: "Invitation could not be reissued. Refresh before trying again.",
    };
  }
}

export async function revokeInvitationAction(
  _: InvitationActionState,
  form: FormData,
): Promise<InvitationActionState> {
  try {
    await revokeOperatorInvitation(
      await requireOperatorSession(),
      text(form, "invitationId"),
    );
    revalidatePath("/operator/onboarding");
    return { ok: true, message: "Invitation revoked." };
  } catch {
    return { ok: false, message: "Invitation could not be changed." };
  }
}

export async function expireInvitationAction(
  _: InvitationActionState,
  form: FormData,
): Promise<InvitationActionState> {
  try {
    await expireOperatorInvitation(
      await requireOperatorSession(),
      text(form, "invitationId"),
    );
    revalidatePath("/operator/onboarding");
    return { ok: true, message: "Invitation expired." };
  } catch {
    return { ok: false, message: "Invitation could not be changed." };
  }
}

function actionResult(
  result: Awaited<ReturnType<typeof createOperatorInvitation>>,
  message: string,
): InvitationActionState {
  return {
    ok: true,
    message,
    invitationUrl: result.invitationUrl,
    invitationId: result.invitation.id,
    emailDeliveryStatus: result.emailDeliveryStatus,
    ownerDisplayName: result.invitation.ownerDisplayName,
    invitedEmail: result.invitation.invitedEmail,
    businessDisplayName: result.invitation.businessDisplayName,
    expiresAt: result.invitation.expiresAt.toISOString(),
  };
}
