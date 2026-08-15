"use client";

import { useActionState, useState, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

import type { InvitationActionState } from "@/app/operator/onboarding/actions";

type Invitation = {
  id: string;
  invitedEmail: string;
  ownerDisplayName: string;
  businessLegalName: string;
  businessDisplayName: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  emailDeliveryStatus: string;
  emailDeliveryAttemptedAt: Date | null;
  emailDeliveryError: string | null;
};
type Action = (
  state: InvitationActionState,
  form: FormData,
) => Promise<InvitationActionState>;
const initialState: InvitationActionState = { ok: false };

export function OperatorOnboardingPanel({
  invitations,
  createAction,
  reissueAction,
  revokeAction,
  expireAction,
}: {
  invitations: Invitation[];
  createAction: Action;
  reissueAction: Action;
  revokeAction: Action;
  expireAction: Action;
}) {
  const [created, create] = useActionState(createAction, initialState);
  return (
    <main className="auth-stage min-h-screen px-4 py-8 text-text-primary sm:px-5 sm:py-10">
      <section className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="ui-card p-6 sm:p-8">
          <p className="auth-kicker">Platform operator</p>
          <h1 className="mt-2 text-3xl font-bold">
            Client onboarding invitations
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
            Send one-time, email-bound invitations. Capture Tracker never grants
            the operator access to client books, reports, documents, or tenant
            membership.
          </p>
        </header>
        <section className="ui-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Create invitation</h2>
              <p className="mt-1 text-sm text-text-muted">
                Email is the normal delivery path. A secure manual link remains
                available for recovery.
              </p>
            </div>
            <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-navy">
              Secure email + one-time link
            </span>
          </div>
          <form action={create} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Client owner email
              <input
                required
                autoComplete="off"
                className="ui-input mt-1"
                name="invitedEmail"
                type="email"
              />
            </label>
            <label className="text-sm font-bold">
              Owner display name
              <input
                required
                autoComplete="off"
                className="ui-input mt-1"
                name="ownerDisplayName"
                maxLength={120}
              />
            </label>
            <label className="text-sm font-bold">
              Legal business name
              <input
                required
                autoComplete="off"
                className="ui-input mt-1"
                name="businessLegalName"
                maxLength={160}
              />
            </label>
            <label className="text-sm font-bold">
              Workspace display name
              <input
                required
                autoComplete="off"
                className="ui-input mt-1"
                name="businessDisplayName"
                maxLength={160}
              />
            </label>
            <label className="flex gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="foundingCustomer" /> Mark as Founding
              Customer · Customer #001 (presentation only)
            </label>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <SubmitButton
                name="deliveryMode"
                value="email"
                pendingLabel="Sending…"
              >
                Send Invitation
              </SubmitButton>
              <SubmitButton
                name="deliveryMode"
                value="manual"
                pendingLabel="Creating…"
                secondary
              >
                Create secure link instead
              </SubmitButton>
            </div>
          </form>
          {created.message && <ResultCard state={created} />}
        </section>
        <section className="ui-card overflow-hidden">
          <header className="border-b border-border-subtle p-5 sm:p-6">
            <h2 className="text-xl font-bold">Invitation status</h2>
            <p className="mt-1 text-sm text-text-muted">
              “Sent” means Cloudflare accepted the message for delivery. It does
              not claim the customer opened it.
            </p>
          </header>
          {invitations.length ? (
            <ul className="divide-y divide-border-subtle">
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  reissueAction={reissueAction}
                  revokeAction={revokeAction}
                  expireAction={expireAction}
                />
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-text-muted">
              No invitations created by this operator.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}

function InvitationRow({
  invitation,
  reissueAction,
  revokeAction,
  expireAction,
}: {
  invitation: Invitation;
  reissueAction: Action;
  revokeAction: Action;
  expireAction: Action;
}) {
  const [reissued, reissue] = useActionState(reissueAction, initialState);
  const active = invitation.status === "PENDING";
  return (
    <li className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold">{invitation.ownerDisplayName}</p>
          <StatusBadge status={invitation.emailDeliveryStatus} />
        </div>
        <dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Email
            </dt>
            <dd className="mt-0.5 break-all">{invitation.invitedEmail}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Workspace
            </dt>
            <dd className="mt-0.5">{invitation.businessDisplayName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Legal business
            </dt>
            <dd className="mt-0.5">{invitation.businessLegalName}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Expires
            </dt>
            <dd className="mt-0.5">{formatDate(invitation.expiresAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-text-muted">
          Invitation {invitation.status.toLowerCase()}
          {invitation.acceptedAt
            ? ` · Accepted ${formatDate(invitation.acceptedAt)}`
            : ""}
        </p>
        {invitation.emailDeliveryStatus === "FAILED" && (
          <p className="mt-2 text-sm text-status-error">
            Email was not sent. Reissuing creates a fresh link and revokes this
            one.
          </p>
        )}
        {reissued.message && <ResultCard state={reissued} compact />}
      </div>
      {active ? (
        <div className="flex flex-wrap content-start gap-2 sm:max-w-64 sm:justify-end">
          <form action={reissue}>
            <input type="hidden" name="invitationId" value={invitation.id} />
            <SubmitButton pendingLabel="Sending…" secondary>
              Send again
            </SubmitButton>
          </form>
          <form
            action={async (form) => {
              await revokeAction(initialState, form);
            }}
          >
            <input type="hidden" name="invitationId" value={invitation.id} />
            <SubmitButton pendingLabel="Revoking…" secondary>
              Revoke invitation
            </SubmitButton>
          </form>
          <form
            action={async (form) => {
              await expireAction(initialState, form);
            }}
          >
            <input type="hidden" name="invitationId" value={invitation.id} />
            <SubmitButton pendingLabel="Expiring…" secondary>
              Expire now
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </li>
  );
}

function ResultCard({
  state,
  compact = false,
}: {
  state: InvitationActionState;
  compact?: boolean;
}) {
  const success = state.ok && state.emailDeliveryStatus === "SENT";
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={`${compact ? "mt-4" : "mt-5"} rounded-xl border p-4 ${state.ok ? "border-brand-teal/40 bg-brand-teal/5" : "border-status-error/30 bg-status-error/5"}`}
    >
      <h3 className="font-bold">
        {success
          ? "Invitation sent"
          : state.emailDeliveryStatus === "FAILED"
            ? "Invitation created, but email couldn't be sent"
            : state.emailDeliveryStatus === "MANUAL_REQUIRED"
              ? "Secure invitation link created"
              : state.ok
                ? "Invitation updated"
                : "Invitation unavailable"}
      </h3>
      <p className="mt-1 text-sm text-text-muted">{state.message}</p>
      {state.ownerDisplayName && (
        <div className="mt-3 text-sm">
          <p className="font-bold">{state.ownerDisplayName}</p>
          <p className="break-all text-text-muted">{state.invitedEmail}</p>
          <p className="text-text-muted">{state.businessDisplayName}</p>
          {state.expiresAt && (
            <p className="mt-1 text-xs text-text-muted">
              Expires {formatDate(new Date(state.expiresAt))}
            </p>
          )}
        </div>
      )}
      {state.invitationUrl && (
        <CopySecureLink invitationUrl={state.invitationUrl} />
      )}
    </div>
  );
}

function CopySecureLink({ invitationUrl }: { invitationUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        className="ui-button ui-button-secondary min-h-11 px-4 text-sm"
        onClick={async () => {
          await navigator.clipboard.writeText(invitationUrl);
          setCopied(true);
        }}
      >
        Copy secure link
      </button>
      {copied && (
        <p role="status" className="mt-2 text-xs font-bold text-brand-navy">
          Secure link copied. Share it only with the intended recipient.
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  children,
  pendingLabel,
  secondary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      disabled={pending}
      className={`ui-button ${secondary ? "ui-button-secondary" : "ui-button-primary"} min-h-11 px-4 disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = deliveryLabel(status);
  const tone =
    status === "SENT"
      ? "bg-brand-teal/15 text-brand-navy"
      : status === "FAILED"
        ? "bg-status-error/10 text-status-error"
        : "bg-surface-muted text-text-muted";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>
      {label}
    </span>
  );
}

function deliveryLabel(status: string) {
  if (status === "SENT") return "Sent";
  if (status === "SENDING") return "Sending";
  if (status === "FAILED") return "Email failed";
  if (status === "MANUAL_REQUIRED" || status === "NOT_CONFIGURED")
    return "Manual secure link";
  return "Not sent";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/Los_Angeles",
  }).format(value);
}
