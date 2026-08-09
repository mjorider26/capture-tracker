import { notFound } from "next/navigation";

import { InvitationAccountForm } from "@/components/invitation-account-form";
import { readInvitationByToken } from "@/lib/auth/operator-invitations";
import { requireAuthenticatedSession } from "@/lib/auth/operator-authorization";

import { acceptInvitationAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const token = (await params).token;
  const invitation = await readInvitationByToken(token);
  if (!invitation) notFound();
  if (!invitation.usable) return <InviteNotice title="Invitation unavailable" detail="This invitation has expired, been revoked, or was already accepted. Ask the platform operator for a new invitation." />;
  let session = null;
  try { session = await requireAuthenticatedSession(); } catch { /* signed-out users can create or sign into their invited account */ }
  if (!session) return <InvitationAccountForm token={token} businessDisplayName={invitation.businessDisplayName} email={invitation.email} />;
  if (session.email !== invitation.email) return <InviteNotice title="Invitation email does not match" detail="Sign in with the email address that received this invitation. It cannot be transferred to another account." />;
  const error = (await searchParams).error;
  return <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary"><section className="auth-card ui-card w-full max-w-md p-7 sm:p-10"><p className="auth-kicker">Capture Tracker</p><h1 className="mt-3 text-3xl font-bold">Welcome to Capture Tracker.</h1><p className="mt-3 text-sm leading-6 text-text-muted">Let’s get {invitation.businessDisplayName}’s S-Corp books set up correctly. This secure one-time setup leads you through accounts, starting books, and reconciliation.</p><p className="mt-3 text-xs text-text-muted">Expires {invitation.expiresAt.toLocaleString()}.</p><form action={acceptInvitationAction} className="mt-7"><input type="hidden" name="token" value={token}/><button className="ui-button ui-button-primary min-h-11 w-full">Set up Capture Tracker</button></form>{error && <p role="alert" className="mt-3 text-sm text-status-error">The invitation could not be accepted. Refresh and try again, or contact the operator.</p>}</section></main>;
}

function InviteNotice({ title, detail }: { title: string; detail: string }) { return <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary"><section className="auth-card ui-card w-full max-w-md p-7 sm:p-10"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{detail}</p></section></main>; }
