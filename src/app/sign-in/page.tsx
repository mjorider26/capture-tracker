"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/components/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    try {
      const result = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        callbackURL: "/app/today",
      });

      if (result.error) {
        setMessage("Sign in could not be completed.");
        return;
      }

      router.replace("/app/today");
      router.refresh();
    } catch {
      setMessage("Sign in could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-page px-5 py-10 text-text-primary">
      <section className="ui-card w-full max-w-md p-7 sm:p-10">
        <p className="text-sm font-bold tracking-wide text-brand-teal">
          Capture Tracker
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em]">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-muted">
          Use the fictional staging account provided for this environment.
        </p>
        <form className="mt-7 grid gap-4" onSubmit={signIn}>
          <label className="grid gap-1 text-sm font-bold">
            Email
            <input
              required
              autoComplete="email"
              className="ui-input"
              name="email"
              type="email"
            />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Password
            <input
              required
              autoComplete="current-password"
              className="ui-input"
              name="password"
              type="password"
            />
          </label>
          <button
            className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          {message ? <p role="alert" className="text-sm text-status-error">{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
