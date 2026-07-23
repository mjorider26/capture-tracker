import { PageHeader, StatusBadge } from "./ui";
import { type TodayDashboard } from "@/lib/data/today-dashboard";

export function TodayExperience({ dashboard }: { dashboard: TodayDashboard }) {
  return (
    <>
      <PageHeader
        eyebrow="Today"
        title={`A clear view of ${dashboard.businessName}`}
        description="Cash, tax planning, and your next weekly-review actions based on the current books."
        action={<StatusBadge tone="locked">Read-only view</StatusBadge>}
      />
      <section
        aria-label="Financial trust layer"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <TrustCard
          label="Available business cash"
          {...dashboard.availableCash}
        />
        <TrustCard label="Tax reserve" {...dashboard.taxReserve} />
        <TrustCard
          label="Projected tax obligation"
          value={dashboard.projectedTax.value}
          explanation={`${dashboard.projectedTax.explanation}${dashboard.projectedTax.dueDate ? ` Due ${dashboard.projectedTax.dueDate}.` : ""}`}
          status={dashboard.projectedTax.status}
        />
        <TrustCard
          label="Reserve gap or surplus"
          {...dashboard.reservePosition}
        />
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.85fr)]">
        <WeeklyReview review={dashboard.weeklyReview} />
        <Changes changes={dashboard.changes} />
      </section>
    </>
  );
}

function TrustCard({
  label,
  value,
  explanation,
  status,
}: {
  label: string;
  value: string;
  explanation: string;
  status: string;
}) {
  const tone =
    status === "positive" || status === "surplus" || status === "available"
      ? "text-[var(--success)]"
      : status === "attention" || status === "gap"
        ? "text-[var(--warning)]"
        : "text-text-primary";
  return (
    <article className="ui-card min-h-40 p-5">
      <p className="text-sm font-bold text-text-muted">{label}</p>
      <p
        className={`money-value mt-5 text-2xl font-bold tracking-[-0.03em] ${tone}`}
      >
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-[var(--text-subtle)]">
        {explanation}
      </p>
    </article>
  );
}
function WeeklyReview({ review }: { review: TodayDashboard["weeklyReview"] }) {
  if (!review)
    return (
      <section className="ui-card p-6">
        <h2 className="text-xl font-bold">Weekly Review</h2>
        <p className="mt-2 text-sm text-text-muted">
          No weekly review is available yet.
        </p>
      </section>
    );
  return (
    <section aria-labelledby="weekly-review" className="ui-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand-teal">
            Main recurring workflow
          </p>
          <h2 id="weekly-review" className="mt-1 text-xl font-bold">
            Weekly Review
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {review.estimatedMinutes}-minute review · {review.completedCount} of{" "}
            {review.tasks.length} complete · {review.status.toLowerCase()}
          </p>
        </div>
        <StatusBadge tone="success">In progress</StatusBadge>
      </div>
      <ol className="mt-5 divide-y divide-border-subtle">
        {review.tasks.map((task) => (
          <li key={task.id} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs ${task.complete ? "border-brand-teal bg-brand-teal text-white" : "border-[var(--border-strong)] text-transparent"}`}
            >
              {task.complete ? "✓" : "•"}
            </span>
            <div>
              <p
                className={`text-sm font-bold ${task.complete ? "text-[var(--text-subtle)] line-through" : "text-text-primary"}`}
              >
                {task.title}
              </p>
              {task.explanation && (
                <p className="mt-1 text-xs leading-5 text-text-muted">
                  {task.explanation}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
function Changes({ changes }: { changes: TodayDashboard["changes"] }) {
  return (
    <section aria-labelledby="changes" className="ui-card p-5 sm:p-6">
      <p className="text-sm font-bold text-brand-teal">
        Rule-based activity summary
      </p>
      <h2 id="changes" className="mt-1 text-xl font-bold">
        What changed and why
      </h2>
      <div className="mt-5 space-y-4">
        {changes.map((change) => (
          <article
            key={change.id}
            className="border-l-2 border-brand-teal pl-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold">{change.title}</p>
              <span className="money-value shrink-0 text-xs font-bold text-brand-navy">
                {change.amount}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-subtle)]">
              {change.date}
            </p>
            <p className="mt-2 text-sm leading-5 text-text-muted">
              {change.explanation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
