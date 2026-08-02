"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { WeeklyReviewTask } from "@/lib/services/weekly-review-tasks-core";

type ActionState = { ok: boolean; message?: string };
type Action = (state: ActionState, data: FormData) => Promise<ActionState>;
const initial: ActionState = { ok: false };
const categories = ["Transactions", "Documents", "Reconciliation", "Taxes"] as const;

export function WeeklyReviewExperience({ review, tasks, basePath, startAction, completeAction, reopenAction }: { review: { id: string; status: string; unresolvedItemCount: number | null; history: Array<{ id: string; action: string; createdAt: string }> } | null; tasks: WeeklyReviewTask[]; basePath: "/app" | "/demo"; startAction: Action; completeAction: Action; reopenAction: Action }) {
  const [startState, start] = useActionState(startAction, initial);
  const [completeState, complete] = useActionState(completeAction, initial);
  const [reopenState, reopen] = useActionState(reopenAction, initial);
  const groups = categories.map((category) => ({ category, tasks: tasks.filter((task) => task.category === category) })).filter((group) => group.tasks.length > 0);

  return <>
    <section className="ui-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Weekly Review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Work directly from current business records. Completing this review records your acknowledgement and never changes or hides outstanding work.</p></div><span className={`ui-status-badge ${tasks.length ? "bg-warning-soft text-[var(--warning)]" : "bg-brand-teal-soft text-brand-teal"}`}>{tasks.length} unresolved</span></div>
      {!review ? <form className="mt-5" action={start}><button className="min-h-11 rounded bg-brand-navy px-4 text-sm font-bold text-white">Start this week&apos;s review</button></form> : <p className="mt-4 text-sm font-bold">{review.status === "COMPLETED" ? `Completed with ${review.unresolvedItemCount ?? 0} unresolved tasks recorded at completion.` : "In progress"}</p>}
      {startState.message && <p role={startState.ok ? "status" : "alert"} className="mt-3 text-sm">{startState.message}</p>}
    </section>

    <section className="mt-6 space-y-5" aria-label="Weekly Review tasks">
      {groups.length === 0 ? <div className="ui-card p-6"><p className="text-sm font-semibold text-brand-teal">Nothing needs your attention right now.</p></div> : groups.map((group) => <section className="ui-card overflow-hidden" key={group.category}><div className="border-b border-border-subtle bg-surface-secondary px-5 py-4 sm:px-6"><h2 className="font-bold">{group.category}</h2><p className="mt-1 text-xs text-text-muted">{group.tasks.length} unresolved {group.tasks.length === 1 ? "task" : "tasks"}</p></div><ul className="divide-y divide-border-subtle">{group.tasks.map((task) => <li key={task.id}><Link href={`${basePath}${task.href}`} className="block p-5 transition-colors hover:bg-surface-secondary sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-brand-navy">{task.title}</p><p className="mt-1 text-sm leading-6 text-text-muted">{task.explanation}</p><p className="mt-2 text-xs font-semibold text-text-subtle">{task.detail}</p></div><span className="ui-status-badge shrink-0 bg-warning-soft text-[var(--warning)]">Unresolved</span></div></Link></li>)}</ul></section>)}
    </section>

    {review && <section className="mt-6 ui-card p-5 sm:p-6"><h2 className="text-lg font-bold">Completion confirmation</h2><p className="mt-1 text-sm leading-6 text-text-muted">This acknowledgement preserves the current task count in history. Underlying tasks stay visible until their record is fixed.</p>{review.status === "OPEN" ? <form className="mt-4" action={complete}><input type="hidden" name="reviewId" value={review.id}/><label className="block text-sm font-bold">Optional note<input name="note" maxLength={500} className="ui-input mt-1"/></label><button className="mt-3 min-h-11 rounded bg-brand-teal px-4 text-sm font-bold text-white">Complete review</button></form> : <form className="mt-4" action={reopen}><input type="hidden" name="reviewId" value={review.id}/><button className="min-h-11 rounded border border-border-subtle px-4 text-sm font-bold">Reopen review</button></form>}{completeState.message && <p role={completeState.ok ? "status" : "alert"} className="mt-3 text-sm">{completeState.message}</p>}{reopenState.message && <p role={reopenState.ok ? "status" : "alert"} className="mt-3 text-sm">{reopenState.message}</p>}<ol className="mt-5 space-y-1 text-xs text-text-muted">{review.history.map((event) => <li key={event.id}>{event.action.toLowerCase().replaceAll("_", " ")} · {new Date(event.createdAt).toLocaleString()}</li>)}</ol></section>}
  </>;
}
