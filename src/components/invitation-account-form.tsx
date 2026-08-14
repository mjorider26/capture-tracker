"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function InvitationAccountForm({
  token,
  businessDisplayName,
  email,
  initialError,
}: {
  token: string;
  businessDisplayName: string;
  email: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(initialError ?? null),
    [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/operator/invitations/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        code?: string;
      };
      if (response.ok) {
        router.push(`/sign-in?invite=${encodeURIComponent(token)}&created=1`);
        return;
      }
      setMessage(
        body.code === "ACCOUNT_EXISTS"
          ? "An account already uses this invited email. Sign in below, then return to accept the invitation."
          : body.code === "INVITATION_UNAVAILABLE"
            ? "This invitation is no longer available. Ask the Capture Tracker operator for a new invitation."
            : body.code === "INVALID_INPUT"
              ? "Check your name and use a password of at least 12 characters that matches in both fields."
              : "Account creation is temporarily unavailable. Your invitation has not been used; try again shortly.",
      );
    } catch {
      setMessage(
        "Account creation is temporarily unavailable. Your invitation has not been used; try again shortly.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary">
      <section className="auth-card ui-card w-full max-w-md p-7 sm:p-10">
        <p className="auth-kicker">Private customer invitation</p>
        <h1 className="mt-3 text-3xl font-bold">
          Create your Capture Tracker account
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          You’re joining <strong>{businessDisplayName}</strong>. This one-time
          invitation is securely bound to {email}; it cannot be transferred to
          another address.
        </p>
        <form
          action="/api/operator/invitations/account"
          method="post"
          className="mt-7 grid gap-4"
          onSubmit={submit}
        >
          <input type="hidden" name="token" value={token} />
          <label className="grid gap-1 text-sm font-bold">
            Your name
            <input
              required
              autoComplete="name"
              className="ui-input"
              name="name"
              maxLength={120}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Invited email
            <input
              required
              readOnly
              autoComplete="email"
              className="ui-input bg-surface-secondary"
              name="email"
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Password
            <input
              required
              autoComplete="new-password"
              className="ui-input"
              minLength={12}
              name="password"
              type="password"
              aria-describedby="password-help"
            />
          </label>
          <p
            id="password-help"
            className="-mt-2 text-xs leading-5 text-text-muted"
          >
            Use at least 12 characters. A password manager is recommended.
          </p>
          <label className="grid gap-1 text-sm font-bold">
            Confirm password
            <input
              required
              autoComplete="new-password"
              className="ui-input"
              minLength={12}
              name="confirmPassword"
              type="password"
            />
          </label>
          <button
            className="ui-button ui-button-primary min-h-12"
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
          {message && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] bg-amber-50 p-3 text-sm leading-5 text-amber-950"
            >
              {message}
            </p>
          )}
        </form>
        <Link
          className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-brand-navy underline underline-offset-4"
          href={`/sign-in?invite=${encodeURIComponent(token)}`}
        >
          Already have an account? Sign in
        </Link>
        <p className="mt-4 text-xs leading-5 text-text-muted">
          Capture Tracker will not create the S-Corp workspace until you sign in
          and accept this invitation.
        </p>
      </section>
    </main>
  );
}
