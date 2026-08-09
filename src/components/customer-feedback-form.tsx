"use client";

import { useActionState } from "react";

type State = { ok: boolean; message?: string };

export function CustomerFeedbackForm({ action, build }: { action: (state: State, form: FormData) => Promise<State>; build: string }) {
  const [state, submit] = useActionState(action, { ok: false });
  return <form action={submit} className="ui-card max-w-2xl space-y-4 p-5 sm:p-6"><input type="hidden" name="route" value={typeof window === "undefined" ? "/app/feedback" : window.location.pathname}/><input type="hidden" name="build" value={build}/><label className="block text-sm font-bold">What happened?<select required name="category" className="ui-input mt-1"><option value="">Choose a category</option><option value="IMPORT">Import</option><option value="ONBOARDING">Setup or onboarding</option><option value="DOCUMENT">Documents</option><option value="ACCOUNTING">Accounting workflow</option><option value="OTHER">Something else</option></select></label><label className="block text-sm font-bold">Short description<textarea required name="description" maxLength={500} rows={5} className="ui-input mt-1" placeholder="Describe the problem without account numbers, financial values, document contents, or passwords."/></label><p className="text-xs leading-5 text-text-muted">Capture Tracker records only this category, description, current route, and build for support. It does not automatically include transactions, balances, documents, or secrets.</p><button className="ui-button ui-button-primary min-h-11 rounded-[var(--radius-sm)] px-4 text-sm font-bold">Send feedback</button>{state.message && <p role="status" className={state.ok ? "text-sm text-brand-teal" : "text-sm text-status-warning"}>{state.message}</p>}</form>;
}
