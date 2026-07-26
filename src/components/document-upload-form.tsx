"use client";

import { useActionState, useState } from "react";

import { uploadDocument, type DocumentUploadState } from "@/app/app/documents/actions";

const initialState: DocumentUploadState = { ok: false };

export function DocumentUploadForm() {
  const [state, action, pending] = useActionState(uploadDocument, initialState);
  const [filename, setFilename] = useState("");
  return <section id="document-upload" className="ui-card scroll-mt-6 p-5 sm:p-6">
    <h2 className="text-lg font-bold">Upload a fictional document</h2>
    <p className="mt-1 text-sm text-text-muted">PDF, JPEG, or PNG only · 10 MiB maximum. Use fictional data only; this local workflow is not approved for real documents.</p>
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm font-bold" htmlFor="document">Document file</label>
      <input id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png" required disabled={pending} className="block w-full text-sm" onChange={(event) => setFilename(event.currentTarget.files?.[0]?.name ?? "")} />
      <p className="text-xs text-text-muted" aria-live="polite">{filename ? `Selected: ${filename}` : "No file selected."}</p>
      <button type="submit" disabled={pending} className="min-h-11 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white disabled:opacity-60">{pending ? "Validating and storing…" : "Upload securely"}</button>
    </form>
    {state.message && <p className={`mt-4 rounded p-3 text-sm ${state.ok ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "bg-red-50 text-red-800"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    {state.ok && !state.message && <p className="mt-4 rounded bg-[var(--brand-teal-soft)] p-3 text-sm text-brand-teal" role="status">{state.outcome === "ACTIVE" ? "Clean scan complete. The private document is active." : state.outcome === "QUARANTINED" ? "The scanner quarantined this document. Its content is unavailable." : state.outcome === "SCANNER_ERROR" ? "The scanner was unavailable. The document remains pending and inaccessible." : "The existing canonical document was retained."}</p>}
  </section>;
}
