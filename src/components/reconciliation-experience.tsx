"use client";

import { useActionState, useMemo, useState } from "react";

import type { AccountingActionState } from "@/lib/services/reconciliation-action";

import { InlineAlert, StatusBadge } from "./ui";

type Detail = {
  id: string;
  accountName: string;
  statementEndingBalance: string;
  calculatedBalance: string;
  difference: string;
  status: string;
  version: number;
  selectedIds: string[];
  candidates: Array<{ id: string; postedAt: string; description: string; amount: string; direction: string }>;
  activities: Array<{
    id: string;
    activityDate: string;
    description: string;
    reference: string | null;
    amount: string;
    direction: string;
    status: string;
    version: number;
    candidates: Array<{ id: string; description: string; postedAt: string; amount: string; version: number; score: number }>;
  }>;
};

type Action = (state: AccountingActionState, form: FormData) => Promise<AccountingActionState>;
type Props = { detail: Detail; saveAction: Action; finalizeAction: Action; matchAction: Action; rejectAction: Action; unmatchAction: Action };

export function ReconciliationExperience({ detail, saveAction, finalizeAction, matchAction, rejectAction, unmatchAction }: Props) {
  const [selected, setSelected] = useState(detail.selectedIds);
  const [saveState, save] = useActionState(saveAction, { status: "idle", message: null });
  const [finalizeState, finalize] = useActionState(finalizeAction, { status: "idle", message: null });
  const editable = detail.status !== "COMPLETED";
  const selectedRows = useMemo(() => new Set(selected), [selected]);

  return <div className="reconciliation-workspace">
    <section className="reconciliation-summary ui-card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Statement ending" value={`$${detail.statementEndingBalance}`} />
      <Metric label="Cleared book balance" value={`$${detail.calculatedBalance}`} />
      <Metric label="Difference" value={`$${detail.difference}`} emphasis />
      <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Record status</p><StatusBadge tone={editable ? "warning" : "success"}>{detail.status}</StatusBadge></div>
    </section>

    {!editable && <div className="mt-5"><InlineAlert title="Immutable reconciliation" tone="locked">This completed reconciliation is preserved as accounting evidence.</InlineAlert></div>}

    {editable && <form action={save} className="reconciliation-selection data-table-shell ui-card mt-5 overflow-hidden">
      <input type="hidden" name="reconciliationId" value={detail.id} />
      <input type="hidden" name="expectedVersion" value={detail.version} />
      <input type="hidden" name="selectedTransactionIds" value={JSON.stringify(selected)} />
      <header className="border-b border-border-subtle p-5 sm:p-6"><p className="ui-page-eyebrow font-bold uppercase">Book activity</p><h2 className="mt-1 text-lg font-bold">Statement-cleared activity</h2><p className="mt-2 text-sm leading-6 text-text-muted">Existing reconciliation selection remains available for statement activity without an imported match.</p></header>
      <div className="divide-y divide-border-subtle">{detail.candidates.map((item) => <label key={item.id} className="reconciliation-candidate flex min-h-16 cursor-pointer items-center gap-3 p-4 sm:px-6"><input className="h-5 w-5 shrink-0" type="checkbox" checked={selectedRows.has(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((value) => value !== item.id))} /><span className="min-w-0 flex-1"><span className="block font-bold">{item.description}</span><span className="mt-1 block text-xs text-text-muted">{new Date(item.postedAt).toLocaleDateString()} · {item.direction.toLowerCase()}</span></span><span className="money-value font-bold">${item.amount}</span></label>)}</div>
      <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6"><button className="ui-button ui-button-primary min-h-11 rounded bg-brand-navy px-4 text-sm font-bold text-white">Save selection ({selected.length})</button>{saveState.message && <p role="status" className="text-sm text-text-muted">{saveState.message}</p>}</div>
    </form>}

    <StatementActivities detail={detail} editable={editable} matchAction={matchAction} rejectAction={rejectAction} unmatchAction={unmatchAction} />

    {editable && <form action={finalize} className="reconciliation-finalize mt-5"><input type="hidden" name="reconciliationId" value={detail.id} /><input type="hidden" name="expectedVersion" value={detail.version} /><button className="ui-button ui-button-primary min-h-11 rounded bg-brand-teal px-4 text-sm font-bold text-white">Finalize only at exact $0.00 difference</button>{finalizeState.message && <p role="status" className="mt-2 text-sm text-text-muted">{finalizeState.message}</p>}</form>}
  </div>;
}

function StatementActivities({ detail, editable, matchAction, rejectAction, unmatchAction }: { detail: Detail; editable: boolean; matchAction: Action; rejectAction: Action; unmatchAction: Action }) {
  if (!detail.activities.length) return <section className="ui-card mt-5 p-5"><h2 className="font-bold">Imported statement activity</h2><p className="mt-2 text-sm text-text-muted">No imported activity is available for this reconciliation.</p></section>;
  return <section className="reconciliation-activities data-table-shell ui-card mt-5 overflow-hidden"><header className="border-b border-border-subtle p-5 sm:p-6"><p className="ui-page-eyebrow font-bold uppercase">Match review</p><h2 className="mt-1 text-lg font-bold">Imported statement activity</h2><p className="mt-2 text-sm leading-6 text-text-muted">Unmatched activity stays visible until an explicit safe match is approved.</p></header><ul className="divide-y divide-border-subtle">{detail.activities.map((activity) => <li key={activity.id} className="p-5 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold">{activity.description}</p><p className="mt-1 text-xs leading-5 text-text-muted">{new Date(activity.activityDate).toLocaleDateString()} · {activity.direction.toLowerCase()} · {activity.reference ?? "No reference"} · {activity.candidates.length} candidates</p></div><div className="flex items-center gap-3"><span className="money-value font-bold">${activity.amount}</span><StatusBadge tone={activity.status === "MATCHED" ? "success" : "warning"}>{activity.status.toLowerCase()}</StatusBadge></div></div>{activity.status === "UNMATCHED" && !activity.candidates.length && <p className="mt-3 text-sm text-text-muted">No candidate matches are currently eligible. This activity remains unmatched.</p>}{editable && activity.status === "MATCHED" && <ActivityAction label="Remove match" action={unmatchAction} fields={{ statementActivityId: activity.id, expectedActivityVersion: String(activity.version), expectedReconciliationVersion: String(detail.version) }} />}{editable && activity.status === "UNMATCHED" && activity.candidates.map((candidate) => <div key={candidate.id} className="reconciliation-match-candidate mt-3"><p className="font-semibold">{candidate.description} · ${candidate.amount}</p><p className="mt-1 text-xs text-text-muted">{new Date(candidate.postedAt).toLocaleDateString()} · match strength {candidate.score}/100</p><div className="mt-3 flex flex-wrap gap-2"><ActivityAction label="Approve match" action={matchAction} fields={{ statementActivityId: activity.id, transactionId: candidate.id, expectedActivityVersion: String(activity.version), expectedTransactionVersion: String(candidate.version), expectedReconciliationVersion: String(detail.version) }} /><ActivityAction label="Reject candidate" action={rejectAction} fields={{ statementActivityId: activity.id, transactionId: candidate.id, expectedActivityVersion: String(activity.version), expectedTransactionVersion: String(candidate.version), expectedReconciliationVersion: String(detail.version) }} /></div></div>)}</li>)}</ul></section>;
}

function ActivityAction({ label, action, fields }: { label: string; action: Action; fields: Record<string, string> }) {
  const [state, submit] = useActionState(action, { status: "idle", message: null });
  return <form action={submit} className="mt-3 flex flex-wrap items-center gap-2">{Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<button className="ui-button ui-button-secondary min-h-10 rounded border border-border-subtle px-3 text-xs font-bold">{label}</button>{state.message && <span role="status" className="text-xs text-text-muted">{state.message}</span>}</form>;
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={emphasis ? "reconciliation-difference" : ""}><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p><p className="money-value mt-2 text-xl font-bold">{value}</p></div>;
}
