"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function CreateAccountPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [accountOutcome, setAccountOutcome] = useState<"created" | "ready" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setAccountOutcome(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/invitations/create-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
          invitationCode: String(form.get("invitationCode") ?? ""),
        }),
      });

      if (!response.ok) {
        setMessage("Account creation could not be completed.");
        return;
      }

      const result = await response.json() as { code?: string };
      if (result.code === "ACCOUNT_CREATED") {
        setAccountOutcome("created");
        return;
      }

      if (result.code === "ACCOUNT_ALREADY_READY") {
        setAccountOutcome("ready");
        return;
      }

      setMessage("Account creation could not be completed.");
    } catch {
      setMessage("Account creation could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary">
      <section className="auth-card ui-card w-full max-w-md p-7 sm:p-10">
        <p className="auth-kicker">
          Owner invitation
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.055em]">
          Create account
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Use an invitation provided by the account owner. Do not enter real data unless production onboarding has been explicitly approved.
        </p>
        <form className="mt-7 grid gap-4" onSubmit={createAccount}>
          <label className="grid gap-1 text-sm font-bold">
            Name
            <input required autoComplete="name" className="ui-input" name="name" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Email
            <input required autoComplete="email" className="ui-input" name="email" type="email" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Password
            <input required autoComplete="new-password" className="ui-input" minLength={12} name="password" type="password" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Confirm password
            <input required autoComplete="new-password" className="ui-input" minLength={12} name="confirmPassword" type="password" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Invitation code
            <input required autoComplete="off" className="ui-input" name="invitationCode" type="password" />
          </label>
          <button
            className="ui-button ui-button-primary min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
          {message ? <p role="alert" className="text-sm text-status-error">{message}</p> : null}
          {accountOutcome ? (
            <div className="grid gap-3" role="status">
              <p className="text-sm text-text-muted">
                {accountOutcome === "created"
                  ? "Your account was created. Sign in to continue."
                  : "Your account is ready. Sign in to continue."}
              </p>
              <button
                className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-5 text-sm font-bold text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
                onClick={() => window.location.assign("/sign-in?created=1")}
                type="button"
              >
                Sign in
              </button>
            </div>
          ) : null}
        </form>
        <p className="mt-5 text-sm text-text-muted">
          Already have an account? <Link className="font-bold text-brand-navy underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal" href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
