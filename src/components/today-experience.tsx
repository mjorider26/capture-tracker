import { type TodayDashboard } from "@/lib/data/today-dashboard";

export function TodayExperience({ dashboard }: { dashboard: TodayDashboard }) {
  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#155eef]">Today</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            A clear view of {dashboard.businessName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63738a]">
            Cash, tax planning, and your next weekly-review actions—based on the
            current books.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#63738a] shadow-sm ring-1 ring-[#dce5f0]">
          Read-only
        </span>
      </header>
      <section
        aria-label="Financial trust layer"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
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
      <section className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
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
      ? "text-[#087b8b]"
      : status === "attention" || status === "gap"
        ? "text-[#a45a00]"
        : "text-[#63738a]";
  return (
    <article className="min-h-44 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0]">
      <p className="text-sm font-semibold text-[#51627a]">{label}</p>
      <p className={`mt-5 text-2xl font-bold tracking-tight ${tone}`}>
        {value}
      </p>
      <p className="mt-3 text-xs leading-5 text-[#6c7b90]">{explanation}</p>
    </article>
  );
}

function WeeklyReview({ review }: { review: TodayDashboard["weeklyReview"] }) {
  if (!review)
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#dce5f0]">
        <h2 className="text-lg font-bold">Weekly Review</h2>
        <p className="mt-2 text-sm text-[#63738a]">
          No weekly review is available yet.
        </p>
      </section>
    );
  return (
    <section
      aria-labelledby="weekly-review"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#155eef]">
            Main recurring workflow
          </p>
          <h2 id="weekly-review" className="mt-1 text-xl font-bold">
            Weekly Review
          </h2>
          <p className="mt-1 text-sm text-[#63738a]">
            {review.estimatedMinutes}-minute review · {review.completedCount} of{" "}
            {review.tasks.length} complete · {review.status.toLowerCase()}
          </p>
        </div>
        <span className="rounded-full bg-[#e7f9fb] px-3 py-1 text-xs font-bold text-[#087b8b]">
          In progress
        </span>
      </div>
      <ol className="mt-5 divide-y divide-[#edf1f6]">
        {review.tasks.map((task) => (
          <li key={task.id} className="flex gap-3 py-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.complete ? "border-[#12b8c8] bg-[#12b8c8] text-white" : "border-[#b7c5d8]"}`}
            >
              {task.complete ? "✓" : ""}
            </span>
            <div>
              <p
                className={`text-sm font-semibold ${task.complete ? "text-[#718198] line-through" : "text-[#10233f]"}`}
              >
                {task.title}
              </p>
              {task.explanation && (
                <p className="mt-1 text-xs leading-5 text-[#6c7b90]">
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
    <section
      aria-labelledby="changes"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0] sm:p-6"
    >
      <p className="text-sm font-semibold text-[#155eef]">
        Rule-based activity summary
      </p>
      <h2 id="changes" className="mt-1 text-xl font-bold">
        What changed and why
      </h2>
      <div className="mt-5 space-y-4">
        {changes.map((change) => (
          <article key={change.id} className="border-l-2 border-[#12b8c8] pl-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-[#10233f]">
                {change.title}
              </p>
              <span className="shrink-0 text-xs font-bold text-[#155eef]">
                {change.amount}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#6c7b90]">{change.date}</p>
            <p className="mt-2 text-sm leading-5 text-[#51627a]">
              {change.explanation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
