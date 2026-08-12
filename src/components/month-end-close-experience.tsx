"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { CloseActionState } from "@/app/app/taxes/close/actions";

import { Card, InlineAlert, PageHeader, StatusBadge } from "./ui";

const initial: CloseActionState = { status: "idle", message: null };
type Check = { key: string; label: string; count: number; detail: string };
type Data = { month: string; status: string; checks: Check[]; journalEntryCount: number; recordedClose: { status: string; confirmedAt: string | null } | null };

const ownerCopy: Record<string, { label: string; href: string }> = {
  imports: { label: "bank transactions still need review", href: "/app/money/import" },
  duplicates: { label: "possible duplicate transactions need a decision", href: "/app/money/import" },
  "owner-transfers": { label: "owner transfers still need a treatment", href: "/app/taxes/owner-money" },
  reimbursements: { label: "reimbursements still need review", href: "/app/taxes/owner-money" },
  payroll: { label: "payroll evidence does not yet match", href: "/app/taxes/payroll" },
  "fixed-assets": { label: "possible fixed assets need review", href: "/app/taxes/fixed-assets" },
  documents: { label: "receipts or documents still need action", href: "/app/documents" },
  reconciliations: { label: "business accounts still need reconciliation", href: "/app/money/reconciliations" },
  "journal-integrity": { label: "accounting integrity needs professional review", href: "/app/activity" },
};

export function MonthEndCloseExperience({ data, action }: { data: Data; action: (state: CloseActionState, formData: FormData) => Promise<CloseActionState> }) {
  const [state, submit, pending] = useActionState(action, initial);
  const ready = data.status === "READY_TO_CLOSE";
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.month}-01T00:00:00Z`));
  const blockers = data.checks.filter((check) => check.count > 0);
  return <>
    <PageHeader eyebrow="Once a month" title={data.recordedClose ? `${month} is closed` : ready ? `Close ${month}` : `Finish ${month}`} description="Review activity, resolve documents, reconcile each account, then close the month. You do not need to discover these pages on your own." />
    <InlineAlert title={data.recordedClose ? "Month complete" : ready ? "Ready to close" : `${blockers.reduce((sum, check) => sum + check.count, 0)} things are blocking this month`} tone={data.recordedClose || ready ? "success" : "warning"}>{data.recordedClose ? "The accounting period is locked. Corrections use controlled accounting flows; history is never rewritten." : ready ? "All deterministic checks pass. Review and confirm when the month is complete." : "Work through the owner-language blockers below. Capture Tracker will update this path as records are resolved."}</InlineAlert>
    <ol className="mt-6 space-y-3" aria-label="Month-end routine">
      {data.checks.map((check, index) => { const copy = ownerCopy[check.key] ?? { label: check.label.toLowerCase(), href: "/app/review" }; return <li className="ui-card p-5" key={check.key}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">Step {index + 1} of {data.checks.length}</p><h2 className="mt-1 font-bold text-brand-navy">{check.count ? `${check.count} ${copy.label}` : check.label}</h2><p className="mt-1 text-sm text-text-muted">{check.detail}</p></div><StatusBadge tone={check.count ? "warning" : "success"}>{check.count ? "NEEDS YOU" : "DONE"}</StatusBadge></div>{check.count ? <Link className="ui-link mt-3 inline-block text-sm font-bold" href={copy.href}>Resolve this step →</Link> : null}</li>; })}
    </ol>
    {data.recordedClose ? <Card className="mt-6 p-5"><p className="font-bold">Recorded close: {data.recordedClose.status.replaceAll("_", " ")}</p></Card> : <form action={submit} className="ui-card mt-6 p-5"><input type="hidden" name="month" value={data.month} /><h2 className="font-bold">Final step · Close month</h2><p className="mt-1 text-sm text-text-muted">Closing locks the accounting period and never deletes or rewrites financial history.</p><label className="mt-4 flex gap-2 text-sm"><input required disabled={!ready} name="confirmation" type="checkbox" />I reviewed the checklist and confirm this month is ready to close.</label><label className="mt-4 block text-sm font-bold text-text-muted">Close note (optional)<textarea className="ui-input mt-1 min-h-20" name="notes" maxLength={1000} /></label>{state.message && <p role={state.status === "error" ? "alert" : "status"} className="mt-4 text-sm font-bold">{state.message}</p>}<button disabled={!ready || pending} className="ui-button ui-button-primary mt-4 min-h-11 px-4 disabled:opacity-60">{pending ? "Closing…" : `Close ${month}`}</button></form>}
  </>;
}
