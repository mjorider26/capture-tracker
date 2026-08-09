import { notFound } from "next/navigation";

import { OperatorOnboardingPanel } from "@/components/operator-onboarding-panel";
import { listOperatorInvitations } from "@/lib/auth/operator-invitations";
import { OperatorAuthorizationError, requireOperatorSession } from "@/lib/auth/operator-authorization";

import { createInvitationAction, expireInvitationAction, revokeInvitationAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function OperatorOnboardingPage() {
  const { invitations } = await loadOperatorOnboarding();
  return <OperatorOnboardingPanel invitations={invitations} createAction={createInvitationAction} revokeAction={revokeInvitationAction} expireAction={expireInvitationAction} />;
}

async function loadOperatorOnboarding() {
  try {
    const operator = await requireOperatorSession();
    const invitations = await listOperatorInvitations(operator);
    return { invitations };
  } catch (error) {
    if (error instanceof OperatorAuthorizationError) notFound();
    throw error;
  }
}
