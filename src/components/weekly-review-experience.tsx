"use client";

import Link from "next/link";
import { useActionState } from "react";

import { buildGuidedFinancialRoutine, routineScale } from "@/lib/services/guided-financial-routine";
import type { WeeklyReviewTask } from "@/lib/services/weekly-review-tasks-core";

type ActionState = { ok: boolean; message?: string };
type Action = (state: ActionState, data: FormData) => Promise<ActionState>;
type BooksCurrent = { date: string | null; blocker: { count: number; date: string; label: string } | null };
const initial: ActionState = { ok: false };

export function WeeklyReviewExperience({ review, tasks, booksCurrent, basePath, startAction, completeAction, reopenAction, canMutate = true }: { review: { id: string; status: string; unresolvedItemCount: number | null; history: Array<{ id: string; action: string; createdAt: string }> } | null; tasks: WeeklyReviewTask[]; booksCurrent: BooksCurrent; basePath: "/app" | "/demo"; startAction: Action; completeAction: Action; reopenAction: Action; canMutate?: boolean }) {
  const [startState, start] = useActionState(startAction, initial);
  const [completeState, complete] = useActionState(completeAction, initial);
  const [reopenState, reopen] = useActionState(reopenAction, initial);
  const steps = buildGuidedFinancialRoutine(tasks);
  const clear = tasks.length === 0;
  const completed = review?.status === "COMPLETED" && clear;

  return <section className="space-y-6">
    <header className="review-command-stage ui-card p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Your weekly routine</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl"><h1 className="text-3xl font-bold tracking-[-0.03em] text-brand-navy">Run My Books</h1><p className="mt-2 text-sm leading-6 text-text-muted">Capture Tracker has assembled only the work that needs you. Follow the steps in order; the protected accounting workflows remain the source of truth.</p></div>
        <span className={`ui-status-badge ${clear ? "bg-brand-teal-soft text-brand-teal" : "bg-warning-soft text-[var(--warning)]"}`}>{routineScale(tasks.length)}</span>
      </div>
      {!review && canMutate ? <form className="mt-5" action={start}><button className="ui-button ui-button-primary min-h-12 px-5">Start Run My Books</button></form> : <p className="mt-4 text-sm font-bold">{!canMutate ? "Read-only professional review" : review?.status === "COMPLETED" ? "This week’s routine was acknowledged." : "Weekly routine in progress"}</p>}
      {startState.message && <p role={startState.ok ? "status" : "alert"} className="mt-3 text-sm">{startState.message}</p>}
    </header>

    {steps.length ? <ol aria-label="Run My Books progress" className="space-y-5">
      {steps.map((step, index) => <li className="review-queue ui-card overflow-hidden" key={step.category}>
        <div className="border-b border-border-subtle bg-surface-secondary px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">Step {index + 1} of {steps.length}</p><span className="ui-status-badge bg-warning-soft text-[var(--warning)]">{step.tasks.length} {step.tasks.length === 1 ? "item" : "items"}</span></div>
          <h2 className="mt-1 text-xl font-bold text-brand-navy">{step.label}</h2><p className="mt-1 text-sm text-text-muted">{step.description}</p>
        </div>
        <ul className="divide-y divide-border-subtle">{step.tasks.map((task) => <li key={task.id}><Link href={`${basePath}${task.href}`} className="block p-5 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-teal sm:px-6"><div className="flex items-start justify-between gap-4"><span className="min-w-0"><strong className="block text-brand-navy">{task.title}</strong><small className="mt-1 block text-sm leading-6 text-text-muted">{task.explanation}</small><small className="mt-2 block text-xs font-semibold text-text-subtle">{task.detail}</small></span><span aria-hidden="true" className="shrink-0 text-brand-teal">→</span></div></Link></li>)}</ul>
      </li>)}
    </ol> : <section className="review-empty ui-card p-6" aria-live="polite"><p className="text-sm font-bold text-brand-teal">Every active review step is clear.</p><p className="mt-2 text-sm text-text-muted">Irrelevant sections were skipped automatically.</p></section>}

    <RoutineFinish booksCurrent={booksCurrent} clear={clear} completed={completed} firstTask={tasks[0]} basePath={basePath} />

    {review ? <section className="ui-card p-5 sm:p-6">
      {canMutate && review.status === "OPEN" && clear ? <><h2 className="text-lg font-bold">Finish this week’s routine</h2><p className="mt-1 text-sm leading-6 text-text-muted">This records your acknowledgement. It does not post, alter, or hide financial records.</p><form className="mt-4" action={complete}><input type="hidden" name="reviewId" value={review.id}/><label className="block text-sm font-bold">Optional note<input name="note" maxLength={500} className="ui-input mt-1"/></label><button className="ui-button ui-button-primary mt-3 min-h-11 px-4">Mark weekly review complete</button></form></> : null}
      {canMutate && review.status === "COMPLETED" && !clear ? <><h2 className="text-lg font-bold">New work needs attention</h2><p className="mt-1 text-sm text-text-muted">Reopen the routine to acknowledge the current exception set after resolving it.</p><form className="mt-4" action={reopen}><input type="hidden" name="reviewId" value={review.id}/><button className="ui-button ui-button-secondary min-h-11 px-4">Reopen Run My Books</button></form></> : null}
      {completeState.message && <p role={completeState.ok ? "status" : "alert"} className="mt-3 text-sm">{completeState.message}</p>}{reopenState.message && <p role={reopenState.ok ? "status" : "alert"} className="mt-3 text-sm">{reopenState.message}</p>}
      <details className="mt-5 border-t border-border-subtle pt-4"><summary className="cursor-pointer text-sm font-bold text-text-muted">Review history</summary><ol className="mt-3 space-y-1 text-xs text-text-muted">{review.history.map((event) => <li key={event.id}>{event.action.toLowerCase().replaceAll("_", " ")} · {new Date(event.createdAt).toLocaleString()}</li>)}</ol></details>
    </section> : null}
  </section>;
}

function RoutineFinish({ booksCurrent, clear, completed, firstTask, basePath }: { booksCurrent: BooksCurrent; clear: boolean; completed: boolean; firstTask?: WeeklyReviewTask; basePath: "/app" | "/demo" }) {
  const date = booksCurrent.date ? formatDate(booksCurrent.date) : "Not established yet";
  if (clear) return <section className="ui-card border border-brand-teal/30 bg-brand-teal-soft p-6" aria-live="polite"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">{completed ? "Weekly review complete" : "Ready to finish"}</p><h2 className="mt-2 text-2xl font-bold text-brand-navy">Books current through: {date}</h2><p className="mt-2 text-sm text-text-muted">No owner-action steps are currently blocking the routine.</p></section>;
  const blockerDate = booksCurrent.blocker ? formatDate(booksCurrent.blocker.date) : date;
  return <section className="ui-card border border-status-warning p-6" aria-live="polite"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--warning)]">Almost done</p><h2 className="mt-2 text-2xl font-bold text-brand-navy">{tasksLabel(firstTask, booksCurrent.blocker?.count ?? 1)} still blocking {blockerDate}</h2><p className="mt-2 text-sm text-text-muted">Resolve the next item, then return here. Capture Tracker will skip cleared sections automatically.</p>{firstTask ? <Link className="ui-button ui-button-primary mt-4 inline-flex min-h-11 items-center px-4" href={`${basePath}${firstTask.href}`}>Continue with {firstTask.title}</Link> : null}</section>;
}

function tasksLabel(task: WeeklyReviewTask | undefined, count: number) {
  if (count > 1) return `${count} items are`;
  return task ? "1 item is" : "Work is";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(value));
}
