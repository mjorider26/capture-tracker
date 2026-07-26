"use client";

import { useActionState } from "react";

import type { ExtractionActionState } from "@/app/app/documents/actions";

const initial: ExtractionActionState = { ok: false };
type Action = (state: ExtractionActionState, data: FormData) => Promise<ExtractionActionState>;
type Attempt = {
  id: string;
  status: string;
  adapterId: string;
  adapterVersion: string;
  completedAt: string | null;
  failureCode: string | null;
  candidates: Array<{ id: string; fieldType: string; originalValue: string; normalizedValue: string | null; confidence: string; reviewState: string; correctedValue: string | null }>;
  history: Array<{ id: string; action: string; createdAt: string }>;
};
const display = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export function DocumentExtractionPanel({ documentId, eligible, attempts, runAction, reviewAction }: { documentId: string; eligible: boolean; attempts: Attempt[]; runAction: Action; reviewAction: Action }) {
  const [runState, run] = useActionState(runAction, initial);
  const [reviewState, review] = useActionState(reviewAction, initial);
  const current = attempts[0];
  return <section className="ui-card p-5 sm:p-6">
    <h2 className="text-lg font-bold">Extraction review</h2>
    <p className="mt-1 text-sm leading-6 text-text-muted">Fictional development extraction only. Review evidence before use; it never updates a transaction or accounting record.</p>
    {eligible ? <form className="mt-4" action={run}><input type="hidden" name="documentId" value={documentId}/><button className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white">Run fictional extraction</button></form> : <p className="mt-4 rounded-[var(--radius-sm)] bg-surface-secondary p-4 text-sm text-text-muted">Extraction is unavailable until this document is active, clean, privately stored, and readable.</p>}
    {runState.message && <p role={runState.ok ? "status" : "alert"} className={`mt-3 text-sm ${runState.ok ? "text-brand-teal" : "text-red-800"}`}>{runState.message}</p>}
    {current && <div className="mt-5 border-t border-border-subtle pt-5">
      <p className="text-sm font-semibold text-text-primary">{display(current.status)} / fictional extraction review</p>
      {current.failureCode && <p className="mt-2 text-sm text-red-800">Safe failure: {display(current.failureCode)}</p>}
      {current.status === "STALE" && <p className="mt-2 text-sm text-[var(--warning)]">This extraction belongs to older evidence and cannot be reviewed.</p>}
      <ul className="mt-4 divide-y divide-border-subtle">
        {current.candidates.map((candidate) => <li key={candidate.id} className="py-4"><p className="text-sm font-bold">{display(candidate.fieldType)} / confidence {candidate.confidence}</p><p className="mt-1 text-sm text-text-muted">{candidate.originalValue}{candidate.normalizedValue ? ` / normalized: ${candidate.normalizedValue}` : ""}</p><p className="mt-1 text-xs text-text-muted">{display(candidate.reviewState)}{candidate.correctedValue ? ` / corrected: ${candidate.correctedValue}` : ""}</p>{candidate.reviewState === "UNREVIEWED" && current.status === "COMPLETED" && <div className="mt-3 flex flex-wrap gap-2"><form action={review}><input type="hidden" name="documentId" value={documentId}/><input type="hidden" name="candidateId" value={candidate.id}/><input type="hidden" name="review" value="ACCEPTED"/><button className="min-h-10 rounded border border-border-subtle px-3 text-sm font-bold">Accept</button></form><form action={review} className="flex flex-wrap gap-2"><input type="hidden" name="documentId" value={documentId}/><input type="hidden" name="candidateId" value={candidate.id}/><input type="hidden" name="review" value="CORRECTED"/><input required name="correctedValue" className="ui-input w-40" defaultValue={candidate.normalizedValue ?? candidate.originalValue}/><button className="min-h-10 rounded border border-border-subtle px-3 text-sm font-bold">Correct</button></form><form action={review}><input type="hidden" name="documentId" value={documentId}/><input type="hidden" name="candidateId" value={candidate.id}/><input type="hidden" name="review" value="REJECTED"/><button className="min-h-10 rounded border border-border-subtle px-3 text-sm font-bold">Reject</button></form></div>}</li>)}
      </ul>
      <ol className="mt-4 space-y-1 text-xs text-text-muted">{current.history.map((event) => <li key={event.id}>{display(event.action)} / {new Date(event.createdAt).toLocaleString()}</li>)}</ol>
    </div>}
    {reviewState.message && <p role={reviewState.ok ? "status" : "alert"} className={`mt-3 text-sm ${reviewState.ok ? "text-brand-teal" : "text-red-800"}`}>{reviewState.message}</p>}
  </section>;
}
