"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { DocumentRemovalActionState } from "@/app/app/documents/actions";

const initialState: DocumentRemovalActionState = { ok: false };

export function DocumentRemovalControl({ documentId, readable, removeAction }: { documentId: string; readable: boolean; removeAction: (previous: DocumentRemovalActionState, formData: FormData) => Promise<DocumentRemovalActionState> }) {
  const [state, action, pending] = useActionState(removeAction, initialState);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.replace("/app/documents"); }, [router, state.ok]);
  return <details className="mt-4">
    <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-sm)] border border-border px-4 text-sm font-bold text-text-primary">••• <span className="ml-2">Document actions</span></summary>
    <form action={action} className="mt-3 rounded-[var(--radius-sm)] border border-border bg-surface p-4 text-sm">
      <input type="hidden" name="documentId" value={documentId} />
      <p className="font-semibold text-text-primary">{readable ? "Delete or archive document" : "Remove document"}</p>
      <p className="mt-1 leading-6 text-text-muted">Unlinked files are removed from private storage. Evidence linked to financial records is archived to preserve accounting history.</p>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-text-primary"><input name="confirmed" type="checkbox" value="yes" required /> I understand this action.</label>
      <button className="ui-button mt-3 min-h-11 rounded-[var(--radius-sm)] border border-red-700 px-4 text-sm font-bold text-red-800 disabled:opacity-60" disabled={pending}>{pending ? "Removing…" : readable ? "Delete / archive" : "Remove document"}</button>
      {state.message && <p role="status" className={`mt-3 ${state.ok ? "text-emerald-800" : "text-red-800"}`}>{state.message}</p>}
    </form>
  </details>;
}
