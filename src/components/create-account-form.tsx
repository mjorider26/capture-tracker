"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export function CreateAccountForm({ endpoint = "/api/invitations/create-account" }: { endpoint?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), confirmPassword: String(form.get("confirmPassword") ?? "") }) });
      if (response.ok && (await response.json() as { code?: string }).code?.match(/^ACCOUNT_/)) { setCreated(true); return; }
      setMessage("Account creation could not be completed.");
    } catch { setMessage("Account creation could not be completed."); } finally { setSubmitting(false); }
  }

  return <form className="mt-7 grid gap-4" onSubmit={submit}>
    <label className="grid gap-1 text-sm font-bold">Name<input required autoComplete="name" className="ui-input" name="name" /></label>
    <label className="grid gap-1 text-sm font-bold">Email<input required autoComplete="email" className="ui-input" name="email" type="email" /></label>
    <label className="grid gap-1 text-sm font-bold">Password<input required autoComplete="new-password" className="ui-input" minLength={12} name="password" type="password" /></label>
    <label className="grid gap-1 text-sm font-bold">Confirm password<input required autoComplete="new-password" className="ui-input" minLength={12} name="confirmPassword" type="password" /></label>
    <button className="ui-button ui-button-primary min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white disabled:opacity-60" disabled={submitting} type="submit">{submitting ? "Creating account…" : "Create account"}</button>
    {message ? <p role="alert" className="text-sm text-status-error">{message}</p> : null}
    {created ? <div className="grid gap-3" role="status"><p className="text-sm text-text-muted">Your account was created. Sign in to continue.</p><Link className="ui-button min-h-11 text-center" href="/sign-in?created=1">Sign in</Link></div> : null}
  </form>;
}
