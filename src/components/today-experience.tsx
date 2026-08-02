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
        description="Your approved cash, planning evidence, and the next financial decision in one working view."
        action={
          <StatusBadge tone="locked">Read-only financial view</StatusBadge>
        }
      />

      <FinancialBriefing dashboard={dashboard} basePath={basePath} />

      {dashboard.isEmptyAccount ? (
        <FirstTransaction basePath={basePath} />
      ) : null}

      <section className="today-workspace mt-9">
        <NeedsAttention dashboard={dashboard} basePath={basePath} />
        <div className="today-supporting-column">
          <CashPosition dashboard={dashboard} />
          <WeeklyReview review={dashboard.weeklyReview} basePath={basePath} />
        </div>
      </section>

      <section className="today-context mt-10">
        <Activity changes={dashboard.changes} basePath={basePath} />
        <QuickActions basePath={basePath} />
      </section>
    </>
  );
}

function FinancialBriefing({
  dashboard,
  basePath,
}: {
  dashboard: TodayDashboard;
  basePath: "/app" | "/demo";
}) {
  return (
    <section aria-label="Financial briefing" className="today-briefing">
      <div className="today-cash-stage">
        <div className="today-circuit-motif" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="today-kicker">Available business cash</p>
        <p className="money-value today-cash-value">
          {dashboard.availableCash.value}
        </p>
        <p className="today-cash-explanation">
          {dashboard.availableCash.explanation}
        </p>
        <div className="today-cash-footer">
          <span className="today-approved-mark">
            Approved cash activity only
          </span>
          <ButtonLink href={`${basePath}/money`} tone="secondary">
            Review transactions
          </ButtonLink>
        </div>
      </div>

      <aside className="today-planning-rail" aria-label="Tax planning position">
        <div className="today-planning-heading">
          <p>Planning position</p>
          <span aria-hidden="true" />
        </div>
        <PlanningMetric
          label="Tax reserve"
          value={dashboard.taxReserve.value}
          detail={
            dashboard.taxReserve.status === "available"
              ? "Dedicated account"
              : "Setup needed"
          }
          tone={
            dashboard.taxReserve.status === "available" ? "success" : "warning"
          }
        />
        <PlanningMetric
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
        <PlanningMetric
          label="Reserve position"
          value={dashboard.reservePosition.value}
          detail={reserveDetail(dashboard.reservePosition.status)}
          tone={reserveTone(dashboard.reservePosition.status)}
        />
      </aside>

      <div
        className="today-activity-ribbon"
        aria-label="Current month activity"
      >
        <RibbonMetric
          label="This-month income"
          value={dashboard.currentActivity.income}
          detail="Posted income only"
          tone="success"
        />
        <RibbonMetric
          label="This-month expenses"
          value={dashboard.currentActivity.expenses}
          detail="Business expenses only"
          tone="neutral"
        />
        <RibbonMetric
          label="Unreviewed"
          value={String(dashboard.currentActivity.unreviewedTransactions)}
          detail="Transactions awaiting review"
          tone={
            dashboard.currentActivity.unreviewedTransactions
              ? "warning"
              : "neutral"
          }
        />
        <RibbonMetric
          label="Document attention"
          value={String(dashboard.currentActivity.documentAttention)}
          detail="Documents needing action"
          tone={
            dashboard.currentActivity.documentAttention ? "warning" : "neutral"
          }
        />
      </div>
    </section>
  );
}

function PlanningMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <div className="today-planning-metric">
      <p>{label}</p>
      <p className="money-value">{value}</p>
      <span className={`today-tone-${tone}`}>{detail}</span>
    </div>
  );
}

function RibbonMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "neutral";
}) {
  return (
    <div className="today-ribbon-metric">
      <p>{label}</p>
      <p className="money-value">{value}</p>
      <span className={`today-tone-${tone}`}>{detail}</span>
    </div>
  );
}

function FirstTransaction({ basePath }: { basePath: string }) {
  return (
    <section className="today-first-transaction mt-7">
      <div>
        <p>Add your first transaction</p>
        <p>
          Your business has no cash account activity yet. Add a transaction to
          begin a ledger-backed financial view.
        </p>
      </div>
      <ButtonLink href={`${basePath}/money/new`} tone="primary">
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
    <section
      className="today-priority-zone"
      aria-labelledby="attention-heading"
    >
      <div className="today-priority-heading">
        <div>
          <p>Decision queue</p>
          <h2 id="attention-heading">Needs your attention</h2>
        </div>
        <StatusBadge tone={openCount ? "warning" : "success"}>
          {openCount ? `${openCount} open` : "All clear"}
        </StatusBadge>
      </div>
      {dashboard.attention.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Nothing is waiting for review">
            Your current attention categories are clear. Continue to monitor the
            books as new activity arrives.
          </EmptyState>
        </div>
      ) : (
        <ol className="today-priority-list">
          {dashboard.attention.slice(0, 5).map((item, index) => (
            <li key={item.id}>
              <Link
                href={`${basePath}/${item.destination}`}
                className={`today-priority-row today-priority-${item.tone}`}
              >
                <span className="today-priority-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="today-priority-count">{item.count}</span>
                <span className="today-priority-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
                <span className="today-priority-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CashPosition({ dashboard }: { dashboard: TodayDashboard }) {
  const share = dashboard.cashVisual.reserveSharePercent;
  const isConfigured = share !== null;
  const description = isConfigured
    ? `${share}% of available cash is held in a dedicated reserve.`
    : "A dedicated tax reserve has not been configured.";

  return (
    <section
      className="today-allocation"
      aria-labelledby="cash-composition-heading"
    >
      <div className="today-allocation-heading">
        <div>
          <p>Cash position</p>
          <h2 id="cash-composition-heading">Cash composition</h2>
        </div>
        <StatusBadge tone="neutral">Approved activity</StatusBadge>
      </div>
      <div className="today-allocation-values">
        <div>
          <p>Available business cash</p>
          <p className="money-value">{dashboard.cashVisual.availableCash}</p>
        </div>
        <div>
          <p>Dedicated reserve</p>
          <p className="money-value">
            {dashboard.cashVisual.dedicatedReserve ?? "Not configured"}
          </p>
        </div>
      </div>
      <div
        className={`today-allocation-rail ${isConfigured ? "is-configured" : "is-empty"}`}
        role="img"
        aria-label={description}
      >
        {isConfigured ? (
          <span style={{ width: `${share}%` }} aria-hidden="true" />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <p className="today-allocation-caption">{description}</p>
      <p className="today-allocation-note">
        This uses approved business cash and the dedicated-reserve account only.
        It does not infer a trend or move money.
      </p>
    </section>
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
      <Panel className="today-review-callout p-6">
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
    <section className="today-review-callout">
      <div className="today-review-topline">
        <div>
          <p>Weekly rhythm</p>
          <h2>Weekly Review</h2>
        </div>
        <StatusBadge tone={review.status === "COMPLETED" ? "success" : "info"}>
          {review.status.toLowerCase().replaceAll("_", " ")}
        </StatusBadge>
      </div>
      <p className="today-review-count">
        <strong>{review.tasks.length}</strong> unresolved
      </p>
      <p className="today-review-task">
        {next?.title ?? "Nothing needs your attention right now."}
      </p>
      <p className="today-review-explanation">
        {next?.explanation ?? "Current record workflows are clear."}
      </p>
      <div className="today-review-footer">
        <span>{review.estimatedMinutes}-minute review</span>
        <ButtonLink href={`${basePath}/review`} tone="quiet">
          Continue review →
        </ButtonLink>
      </div>
    </section>
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
    income: "today-activity-income",
    expense: "today-activity-expense",
    planning: "today-activity-planning",
    equity: "today-activity-equity",
  };

  return (
    <section className="today-activity" aria-labelledby="activity-heading">
      <div className="today-activity-heading">
        <div>
          <p>Latest ledger context</p>
          <h2 id="activity-heading">What changed and why</h2>
        </div>
        <Link href={`${basePath}/activity`} className="ui-link text-sm">
          Full activity
        </Link>
      </div>
      <ol className="today-activity-list">
        {changes.map((change, index) => (
          <li key={change.id} className={tone[change.tone]}>
            <span className="today-activity-dot" aria-hidden="true" />
            {index < changes.length - 1 ? (
              <span className="today-activity-line" aria-hidden="true" />
            ) : null}
            <article>
              <div>
                <p>{change.title}</p>
                {change.amount ? (
                  <span className="money-value">{change.amount}</span>
                ) : null}
              </div>
              <time>{change.date}</time>
              <p>{change.explanation}</p>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuickActions({ basePath }: { basePath: string }) {
  const actions = [
    {
      label: "Review transactions",
      detail: "Classify pending business activity",
      href: `${basePath}/money`,
    },
    {
      label: "Continue Weekly Review",
      detail: "Work through the current checklist",
      href: `${basePath}/review`,
    },
    {
      label: "View reports",
      detail: "Read the ledger-backed financial view",
      href: `${basePath}/reports`,
    },
    {
      label: "Review documents",
      detail: "Validate supporting evidence",
      href: `${basePath}/documents`,
    },
  ];

  return (
    <nav className="today-actions" aria-label="Protected workflows">
      <div>
        <p>Protected workflows</p>
        <span>Choose the next task</span>
      </div>
      <div>
        {actions.map((action) => (
          <Link key={action.label} href={action.href}>
            <span>{action.label}</span>
            <span>{action.detail}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </nav>
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
