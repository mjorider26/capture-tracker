import Link from "next/link";

import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeading,
  StatusBadge,
} from "./ui";
import { type TodayDashboard } from "@/lib/data/today-dashboard";

export function TodayExperience({
  dashboard,
  basePath,
}: {
  dashboard: TodayDashboard;
  basePath: "/app" | "/demo";
}) {
  return (
    <>
      <PageHeader
        eyebrow="Capture Tracker Today"
        title={dashboard.businessName}
        description="A concise financial briefing built from approved books, current planning evidence, and the work that needs your attention next."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusBadge tone="locked">Read-only financial view</StatusBadge>
            <ButtonLink href={`${basePath}/money`} tone="primary">
              Review transactions
            </ButtonLink>
          </div>
        }
      />

      <ExecutiveSummary dashboard={dashboard} />

      {dashboard.isEmptyAccount ? (
        <FirstTransaction basePath={basePath} />
      ) : null}

      <section className="mt-6 grid gap-6 min-[980px]:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <NeedsAttention dashboard={dashboard} basePath={basePath} />
        <CashPosition dashboard={dashboard} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Activity changes={dashboard.changes} basePath={basePath} />
        <WeeklyReview review={dashboard.weeklyReview} basePath={basePath} />
      </section>

      <QuickActions basePath={basePath} />
    </>
  );
}

function ExecutiveSummary({ dashboard }: { dashboard: TodayDashboard }) {
  return (
    <section aria-label="Financial briefing" className="ui-briefing text-white">
      <div className="relative z-10 grid gap-8 p-6 sm:p-8 min-[1180px]:grid-cols-[minmax(0,1.1fr)_minmax(30rem,0.9fr)] min-[1180px]:p-9">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-100/75">
            Available business cash
          </p>
          <p className="money-value mt-4 text-5xl font-bold tracking-[-0.06em] sm:text-6xl">
            {dashboard.availableCash.value}
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-200">
            {dashboard.availableCash.explanation}
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-teal-100">
            <span
              className="h-2 w-2 rounded-full bg-brand-teal"
              aria-hidden="true"
            />
            Approved cash activity only
          </span>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-3 min-[1180px]:grid-cols-1">
          <BriefingMetric
            label="Tax reserve"
            value={dashboard.taxReserve.value}
            detail={
              dashboard.taxReserve.status === "available"
                ? "Dedicated account"
                : "Setup needed"
            }
            tone={
              dashboard.taxReserve.status === "available"
                ? "success"
                : "warning"
            }
          />
          <BriefingMetric
            label="Projected tax"
            value={dashboard.projectedTax.value}
            detail={
              dashboard.projectedTax.dueDate
                ? `Due ${dashboard.projectedTax.dueDate}`
                : "No current estimate"
            }
            tone={
              dashboard.projectedTax.status === "attention"
                ? "warning"
                : "neutral"
            }
          />
          <BriefingMetric
            label="Reserve position"
            value={dashboard.reservePosition.value}
            detail={reserveDetail(dashboard.reservePosition.status)}
            tone={reserveTone(dashboard.reservePosition.status)}
          />
        </div>
      </div>

      <div className="relative z-10 grid border-t border-white/10 bg-white/[0.04] sm:grid-cols-2 xl:grid-cols-4">
        <BriefingMetric
          label="This-month income"
          value={dashboard.currentActivity.income}
          detail="Posted income only"
          tone="success"
          compact
        />
        <BriefingMetric
          label="This-month expenses"
          value={dashboard.currentActivity.expenses}
          detail="Business expenses only"
          tone="neutral"
          compact
        />
        <BriefingMetric
          label="Unreviewed"
          value={String(dashboard.currentActivity.unreviewedTransactions)}
          detail="Transactions awaiting review"
          tone={
            dashboard.currentActivity.unreviewedTransactions
              ? "warning"
              : "neutral"
          }
          compact
        />
        <BriefingMetric
          label="Document attention"
          value={String(dashboard.currentActivity.documentAttention)}
          detail="Documents needing action"
          tone={
            dashboard.currentActivity.documentAttention ? "warning" : "neutral"
          }
          compact
        />
      </div>
    </section>
  );
}

function BriefingMetric({
  label,
  value,
  detail,
  tone,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
  compact?: boolean;
}) {
  const marker =
    tone === "success"
      ? "bg-brand-teal"
      : tone === "warning"
        ? "bg-amber-300"
        : "bg-slate-400";

  return (
    <div
      className={
        compact
          ? "min-w-0 border-b border-white/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 xl:border-r xl:last:border-r-0"
          : "ui-metric-tile"
      }
    >
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p
        className={`money-value mt-2 break-words font-bold tracking-[-0.04em] text-white ${compact ? "text-2xl" : "text-xl"}`}
      >
        {value}
      </p>
      <p className="mt-2 flex gap-2 text-xs leading-5 text-slate-300">
        <span
          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${marker}`}
          aria-hidden="true"
        />
        {detail}
      </p>
    </div>
  );
}

function FirstTransaction({ basePath }: { basePath: string }) {
  return (
    <section className="mt-6 border-l-4 border-brand-teal bg-surface-tint px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div>
        <p className="text-sm font-bold text-text-primary">
          Add your first transaction
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
          Your business has no cash account activity yet. Add a transaction to
          begin a ledger-backed financial view.
        </p>
      </div>
      <ButtonLink
        href={`${basePath}/money/new`}
        tone="primary"
        className="mt-4 shrink-0 sm:mt-0"
      >
        Add transaction
      </ButtonLink>
    </section>
  );
}

function NeedsAttention({
  dashboard,
  basePath,
}: {
  dashboard: TodayDashboard;
  basePath: string;
}) {
  const openCount = dashboard.attention.reduce(
    (total, item) => total + item.count,
    0,
  );

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="Decision queue"
        title="Needs your attention"
        action={
          <StatusBadge tone={openCount ? "warning" : "success"}>
            {openCount ? `${openCount} open` : "All clear"}
          </StatusBadge>
        }
      />
      {dashboard.attention.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing is waiting for review">
            Your current attention categories are clear. Continue to monitor the
            books as new activity arrives.
          </EmptyState>
        </div>
      ) : (
        <ol className="mt-5 space-y-2">
          {dashboard.attention.slice(0, 5).map((item) => (
            <li key={item.id}>
              <Link
                href={`${basePath}/${item.destination}`}
                className="ui-action-surface group flex items-start gap-3 p-3 focus-visible:outline-none"
              >
                <span
                  className={`grid h-9 min-w-9 place-items-center rounded-full text-xs font-bold ${item.tone === "urgent" ? "bg-[var(--danger)]/10 text-[var(--danger)]" : item.tone === "warning" ? "bg-warning-soft text-[var(--warning)]" : "bg-brand-teal-soft text-brand-teal"}`}
                >
                  {item.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text-primary group-hover:text-brand-teal">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-text-muted">
                    {item.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="pt-1 text-text-subtle transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function CashPosition({ dashboard }: { dashboard: TodayDashboard }) {
  const share = dashboard.cashVisual.reserveSharePercent;
  const description =
    share === null
      ? "No dedicated tax reserve is configured."
      : `${share}% of available cash is held in a dedicated reserve.`;
  const label =
    share === null
      ? "A dedicated reserve is not configured, so no share of cash can be shown."
      : `${dashboard.cashVisual.dedicatedReserve} is ${share}% of available business cash.`;

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="Cash position"
        title="Cash composition"
        action={<StatusBadge tone="neutral">Approved activity</StatusBadge>}
      />
      <div className="mt-8" role="img" aria-label={label}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-text-muted">
              Available business cash
            </p>
            <p className="money-value mt-1 text-3xl font-bold tracking-[-0.045em] text-brand-navy">
              {dashboard.cashVisual.availableCash}
            </p>
          </div>
          {dashboard.cashVisual.dedicatedReserve ? (
            <div className="text-right">
              <p className="text-xs font-bold text-text-muted">
                Dedicated reserve
              </p>
              <p className="money-value mt-1 text-lg font-bold text-brand-teal">
                {dashboard.cashVisual.dedicatedReserve}
              </p>
            </div>
          ) : null}
        </div>
        <div
          className="mt-6 h-3 overflow-hidden rounded-full bg-surface-tertiary"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-brand-teal transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${share ?? 0}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between gap-4 text-xs leading-5 text-text-muted">
          <span>{description}</span>
          {share !== null ? (
            <span className="money-value shrink-0 font-bold text-brand-navy">
              {share}%
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-6 border-t border-border-subtle pt-4 text-sm leading-6 text-text-muted">
        This proportional summary uses the same approved business cash and
        dedicated-reserve accounts shown above. It does not infer a trend or
        move money.
      </p>
    </Panel>
  );
}

function WeeklyReview({
  review,
  basePath,
}: {
  review: TodayDashboard["weeklyReview"];
  basePath: string;
}) {
  if (!review) {
    return (
      <Panel className="p-6">
        <SectionHeading eyebrow="Weekly rhythm" title="Weekly Review" />
        <p className="mt-4 text-sm leading-6 text-text-muted">
          No weekly review is available yet. Once started, progress and
          unresolved work will appear here.
        </p>
      </Panel>
    );
  }

  const next = review.tasks[0];
  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="Weekly rhythm"
        title="Weekly Review"
        action={
          <StatusBadge
            tone={review.status === "COMPLETED" ? "success" : "info"}
          >
            {review.status.toLowerCase().replaceAll("_", " ")}
          </StatusBadge>
        }
      />
      <div className="mt-6 rounded-[var(--radius-md)] bg-surface-secondary p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
          Current task count
        </p>
        <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-text-primary">
          {review.tasks.length} unresolved
        </p>
        <p className="mt-3 text-sm font-bold text-text-primary">
          {next?.title ?? "Nothing needs your attention right now."}
        </p>
        <p className="mt-1 text-xs leading-5 text-text-muted">
          {next?.explanation ?? "Current record workflows are clear."}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-text-muted">
          {review.estimatedMinutes}-minute review · unresolved work remains
          visible
        </p>
        <ButtonLink href={`${basePath}/review`} tone="secondary">
          Continue review
        </ButtonLink>
      </div>
    </Panel>
  );
}

function Activity({
  changes,
  basePath,
}: {
  changes: TodayDashboard["changes"];
  basePath: string;
}) {
  const tone = {
    income: "bg-brand-teal",
    expense: "bg-[var(--danger)]",
    planning: "bg-[var(--warning)]",
    equity: "bg-[var(--info)]",
  };

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        eyebrow="Latest ledger context"
        title="What changed and why"
        action={
          <Link href={`${basePath}/activity`} className="ui-link text-xs">
            Full activity
          </Link>
        }
      />
      <ol className="mt-6 space-y-0">
        {changes.map((change, index) => (
          <li
            key={change.id}
            className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
          >
            <span className="relative z-10 mt-1.5 flex h-3 w-3 rounded-full border-2 border-white shadow-sm">
              <span
                className={`h-full w-full rounded-full ${tone[change.tone]}`}
              />
            </span>
            {index < changes.length - 1 ? (
              <span
                className="absolute left-[5px] top-5 h-[calc(100%-0.6rem)] w-px bg-border-subtle"
                aria-hidden="true"
              />
            ) : null}
            <article className="min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-text-primary">
                  {change.title}
                </p>
                {change.amount ? (
                  <span className="money-value shrink-0 text-xs font-bold text-brand-navy">
                    {change.amount}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-semibold text-text-subtle">
                {change.date}
              </p>
              <p className="mt-1 text-xs leading-5 text-text-muted">
                {change.explanation}
              </p>
            </article>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function QuickActions({ basePath }: { basePath: string }) {
  const actions = [
    {
      label: "Review transactions",
      detail: "Classify pending business activity",
      href: `${basePath}/money`,
      mark: "◇",
    },
    {
      label: "Continue Weekly Review",
      detail: "Work through the current checklist",
      href: `${basePath}/review`,
      mark: "✓",
    },
    {
      label: "View reports",
      detail: "Read the ledger-backed financial view",
      href: `${basePath}/reports`,
      mark: "≡",
    },
    {
      label: "Review documents",
      detail: "Validate supporting evidence",
      href: `${basePath}/documents`,
      mark: "□",
    },
  ];

  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold tracking-[-0.02em]">
          Protected workflows
        </h2>
        <p className="text-xs text-text-muted">Choose the next task</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="ui-action-surface group px-4 py-4 focus-visible:outline-none"
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-teal-soft text-brand-teal"
              aria-hidden="true"
            >
              {action.mark}
            </span>
            <p className="mt-4 text-sm font-bold text-text-primary group-hover:text-brand-teal">
              {action.label}
            </p>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              {action.detail}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function reserveDetail(
  status: TodayDashboard["reservePosition"]["status"],
): string {
  if (status === "surplus") return "Reserve exceeds obligation";
  if (status === "gap") return "Funding attention";
  return "Needs reserve + estimate";
}

function reserveTone(
  status: TodayDashboard["reservePosition"]["status"],
): "success" | "warning" | "neutral" {
  if (status === "surplus") return "success";
  if (status === "gap") return "warning";
  return "neutral";
}
