import Link from "next/link";

import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
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
        description="A calm view of approved books, current planning evidence, and the work that needs your attention next."
        action={<StatusBadge tone="locked">Read-only financial view</StatusBadge>}
      />
      <ExecutiveSummary dashboard={dashboard} />
      {dashboard.isEmptyAccount && <section className="ui-card mt-6 p-6"><h2 className="text-lg font-bold">Add your first transaction</h2><p className="mt-2 text-sm text-text-muted">Your business has no cash account activity yet. Add a transaction to begin a ledger-backed financial view.</p><ButtonLink href={`${basePath}/money/new`} tone="primary" className="mt-4">Add transaction</ButtonLink></section>}
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <CashPosition dashboard={dashboard} />
        <NeedsAttention dashboard={dashboard} basePath={basePath} />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <WeeklyReview review={dashboard.weeklyReview} basePath={basePath} />
        <Activity changes={dashboard.changes} basePath={basePath} />
      </section>
      <QuickActions basePath={basePath} />
    </>
  );
}

function ExecutiveSummary({ dashboard }: { dashboard: TodayDashboard }) {
  return (
    <section aria-label="Executive financial summary" className="overflow-hidden rounded-[var(--radius-xl)] bg-brand-navy text-white shadow-[var(--shadow-elevated)]">
      <div className="grid min-[1180px]:grid-cols-[minmax(0,1.25fr)_minmax(30rem,0.75fr)]">
        <div className="relative p-6 sm:p-8 min-[1180px]:p-9">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-brand-teal/20 blur-3xl" aria-hidden="true" />
          <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-teal-100/70">Available business cash</p>
          <p className="money-value relative mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{dashboard.availableCash.value}</p>
          <p className="relative mt-4 max-w-xl text-sm leading-6 text-slate-300">{dashboard.availableCash.explanation}</p>
          <span className="relative mt-6 inline-flex items-center gap-2 text-xs font-bold text-teal-100"><span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden="true" />Approved cash activity only</span>
        </div>
        <div className="grid border-t border-white/10 bg-white/[0.055] sm:grid-cols-3 min-[1180px]:border-l min-[1180px]:border-t-0">
          <SummaryMetric label="Tax reserve" value={dashboard.taxReserve.value} detail={dashboard.taxReserve.status === "available" ? "Dedicated account" : "Setup needed"} tone={dashboard.taxReserve.status === "available" ? "success" : "warning"} />
          <SummaryMetric label="Projected tax" value={dashboard.projectedTax.value} detail={dashboard.projectedTax.dueDate ? `Due ${dashboard.projectedTax.dueDate}` : "No current estimate"} tone={dashboard.projectedTax.status === "attention" ? "warning" : "neutral"} />
          <SummaryMetric label="Reserve position" value={dashboard.reservePosition.value} detail={dashboard.reservePosition.status === "surplus" ? "Reserve exceeds obligation" : dashboard.reservePosition.status === "gap" ? "Funding attention" : "Needs reserve + estimate"} tone={dashboard.reservePosition.status === "surplus" ? "success" : dashboard.reservePosition.status === "gap" ? "warning" : "neutral"} />
        </div>
      </div>
      <div className="grid border-t border-white/10 bg-white/[0.035] sm:grid-cols-4"><SummaryMetric label="This-month income" value={dashboard.currentActivity.income} detail="Posted income only" tone="success"/><SummaryMetric label="This-month expenses" value={dashboard.currentActivity.expenses} detail="Business expenses only" tone="neutral"/><SummaryMetric label="Unreviewed" value={String(dashboard.currentActivity.unreviewedTransactions)} detail="Transactions awaiting review" tone={dashboard.currentActivity.unreviewedTransactions ? "warning" : "neutral"}/><SummaryMetric label="Document attention" value={String(dashboard.currentActivity.documentAttention)} detail="Documents needing action" tone={dashboard.currentActivity.documentAttention ? "warning" : "neutral"}/></div>
    </section>
  );
}

function SummaryMetric({
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
  const dot = tone === "success" ? "bg-brand-teal" : tone === "warning" ? "bg-amber-300" : "bg-slate-400";
  return (
    <div className="min-w-0 border-b border-white/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 min-[1180px]:border-r-0 min-[1180px]:border-b min-[1180px]:last:border-b-0">
      <p className="text-xs font-bold text-slate-300">{label}</p>
      <p className="money-value mt-3 break-words text-xl font-bold tracking-[-0.035em] text-white">{value}</p>
      <p className="mt-3 flex gap-2 text-xs leading-5 text-slate-300"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />{detail}</p>
    </div>
  );
}

function CashPosition({ dashboard }: { dashboard: TodayDashboard }) {
  const share = dashboard.cashVisual.reserveSharePercent;
  const label = share === null
    ? "A dedicated reserve is not configured, so no share of cash can be shown."
    : `${dashboard.cashVisual.dedicatedReserve} is ${share}% of available business cash.`;
  return (
    <Panel className="border border-border-subtle p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Cash position</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">Current cash composition</h2>
        </div>
        <span className="ui-status-badge bg-surface-secondary text-text-muted">Approved activity</span>
      </div>
      <div className="mt-7" role="img" aria-label={label}>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-text-muted">Available business cash</p>
            <p className="money-value mt-1 text-3xl font-bold tracking-[-0.04em] text-brand-navy">{dashboard.cashVisual.availableCash}</p>
          </div>
          {dashboard.cashVisual.dedicatedReserve && <div className="text-right"><p className="text-xs font-bold text-text-muted">Dedicated reserve</p><p className="money-value mt-1 text-lg font-bold text-brand-teal">{dashboard.cashVisual.dedicatedReserve}</p></div>}
        </div>
        <div className="mt-5 h-4 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-teal transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${share ?? 0}%` }} />
        </div>
        <div className="mt-3 flex justify-between gap-4 text-xs leading-5 text-text-muted">
          <span>{share === null ? "No dedicated tax reserve is configured." : `${share}% of available cash is held in a dedicated reserve.`}</span>
          {share !== null && <span className="shrink-0 font-bold text-brand-navy">{share}%</span>}
        </div>
      </div>
      <p className="mt-6 border-t border-border-subtle pt-4 text-sm leading-6 text-text-muted">This proportional summary uses the same approved business cash and dedicated-reserve accounts shown above. It does not infer a trend or move money.</p>
    </Panel>
  );
}

function NeedsAttention({ dashboard, basePath }: { dashboard: TodayDashboard; basePath: string }) {
  return (
    <Panel className="border border-border-subtle p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--warning)]">Decision queue</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">Needs your attention</h2>
        </div>
        <span className="ui-status-badge bg-warning-soft text-[var(--warning)]">{dashboard.attention.reduce((total, item) => total + item.count, 0)} open</span>
      </div>
      {dashboard.attention.length === 0 ? (
        <div className="mt-6"><EmptyState title="Nothing is waiting for review">Your current attention categories are clear. Continue to monitor the books as new activity arrives.</EmptyState></div>
      ) : (
        <ol className="mt-5 divide-y divide-border-subtle">
          {dashboard.attention.slice(0, 5).map((item) => (
            <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
              <Link href={`${basePath}/${item.destination}`} className="group flex items-start gap-3 rounded-[var(--radius-sm)] focus-visible:outline-none">
                <span className={`grid h-8 min-w-8 place-items-center rounded-full text-xs font-bold ${item.tone === "urgent" ? "bg-[var(--danger)]/10 text-[var(--danger)]" : item.tone === "warning" ? "bg-warning-soft text-[var(--warning)]" : "bg-brand-teal-soft text-brand-teal"}`}>{item.count}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-text-primary group-hover:text-brand-teal">{item.label}</span><span className="mt-1 block text-xs leading-5 text-text-muted">{item.description}</span></span>
                <span aria-hidden="true" className="pt-1 text-text-subtle transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function WeeklyReview({ review, basePath }: { review: TodayDashboard["weeklyReview"]; basePath: string }) {
  if (!review) return <Panel className="border border-border-subtle p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Weekly rhythm</p><h2 className="mt-1 text-xl font-bold">Weekly Review</h2><p className="mt-3 text-sm leading-6 text-text-muted">No weekly review is available yet. Once started, progress and unresolved work will appear here.</p></Panel>;
  const next = review.tasks[0];
  return (
    <Panel className="border border-border-subtle p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Weekly rhythm</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">Weekly Review</h2></div>
        <StatusBadge tone={review.status === "COMPLETED" ? "success" : "info"}>{review.status.toLowerCase().replaceAll("_", " ")}</StatusBadge>
      </div>
      <div className="mt-6 rounded-[var(--radius-md)] bg-surface-secondary p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-text-muted">Current task count</p><p className="mt-1 text-2xl font-bold text-text-primary">{review.tasks.length} unresolved</p><p className="mt-2 text-sm font-bold text-text-primary">{next?.title ?? "Nothing needs your attention right now."}</p><p className="mt-1 text-xs leading-5 text-text-muted">{next?.explanation ?? "Current record workflows are clear."}</p></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-semibold text-text-muted">{review.estimatedMinutes}-minute review · unresolved work remains visible</p><ButtonLink href={`${basePath}/review`} tone="secondary">Continue review</ButtonLink></div>
    </Panel>
  );
}

function Activity({ changes, basePath }: { changes: TodayDashboard["changes"]; basePath: string }) {
  const tone = { income: "bg-brand-teal", expense: "bg-[var(--danger)]", planning: "bg-[var(--warning)]", equity: "bg-[var(--info)]" };
  return (
    <Panel className="border border-border-subtle p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Latest ledger context</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em]">What changed and why</h2></div><Link href={`${basePath}/activity`} className="ui-link text-xs">Full activity</Link></div>
      <ol className="mt-5 space-y-0">
        {changes.map((change, index) => <li key={change.id} className="relative grid grid-cols-[1rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0"><span className="relative z-10 mt-1.5 flex h-3 w-3 rounded-full border-2 border-white shadow-sm"><span className={`h-full w-full rounded-full ${tone[change.tone]}`} /></span>{index < changes.length - 1 && <span className="absolute left-[5px] top-5 h-[calc(100%-0.6rem)] w-px bg-border-subtle" aria-hidden="true" />}<article className="min-w-0"><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-bold text-text-primary">{change.title}</p>{change.amount && <span className="money-value shrink-0 text-xs font-bold text-brand-navy">{change.amount}</span>}</div><p className="mt-1 text-xs font-semibold text-text-subtle">{change.date}</p><p className="mt-1 text-xs leading-5 text-text-muted">{change.explanation}</p></article></li>)}
      </ol>
    </Panel>
  );
}

function QuickActions({ basePath }: { basePath: string }) {
  const actions = [
    { label: "Review transactions", detail: "Classify pending business activity", href: `${basePath}/money`, mark: "◇" },
    { label: "Continue Weekly Review", detail: "Work through the current checklist", href: `${basePath}/review`, mark: "✓" },
    { label: "View reports", detail: "Read the ledger-backed financial view", href: `${basePath}/reports`, mark: "≡" },
    { label: "Review documents", detail: "Validate supporting evidence", href: `${basePath}/documents`, mark: "□" },
  ];
  return <section className="mt-6"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-base font-bold tracking-[-0.02em]">Quick actions</h2><p className="text-xs text-text-muted">Existing protected workflows</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.map((action) => <Link key={action.label} href={action.href} className="group rounded-[var(--radius-md)] border border-border-subtle bg-surface px-4 py-4 shadow-[var(--shadow-subtle)] transition hover:-translate-y-0.5 hover:border-[var(--brand-teal)]/40 hover:shadow-md"><span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand-teal-soft text-brand-teal" aria-hidden="true">{action.mark}</span><p className="mt-4 text-sm font-bold text-text-primary group-hover:text-brand-teal">{action.label}</p><p className="mt-1 text-xs leading-5 text-text-muted">{action.detail}</p></Link>)}</div></section>;
}
