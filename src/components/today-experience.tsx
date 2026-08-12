import Link from "next/link";

import type { TodayDashboard } from "@/lib/data/today-dashboard";
import { routineScale } from "@/lib/services/guided-financial-routine";

import { ButtonLink, PageHeader, StatusBadge } from "./ui";

export function TodayExperience({ dashboard, basePath }: { dashboard: TodayDashboard; basePath: "/app" | "/demo" }) {
  const needsNow = dashboard.attention.filter((item) => ["transactions", "documents", "matches", "reconciliations"].includes(item.id));
  const comingUp = dashboard.attention.filter((item) => ["tax", "payroll", "reviewTasks"].includes(item.id));
  const attentionCount = needsNow.reduce((sum, item) => sum + item.count, 0) + comingUp.reduce((sum, item) => sum + item.count, 0);
  const routineCount = dashboard.weeklyReview?.tasks.length ?? attentionCount;
  const calm = attentionCount === 0;
  const setupHref = basePath === "/app" ? "/app/onboarding" : "/demo/money/reconciliations";

  return <section className="space-y-7">
    <PageHeader eyebrow="Today" title="What needs you today" description={`${dashboard.businessName}. Capture Tracker brings forward the next owner decision and keeps accounting detail available only when you need it.`} action={<StatusBadge tone={calm ? "success" : "info"}>{calm ? "You’re caught up" : `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} attention`}</StatusBadge>} />

    <BookStatus dashboard={dashboard} basePath={basePath} />

    {dashboard.setup?.incomplete ? <section className="ui-card border border-status-warning p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Finish first-time setup</p><p className="mt-1 max-w-2xl text-sm text-text-muted">Tell Capture Tracker where your books start and reach the first exact reconciliation.</p></div><ButtonLink href={setupHref} tone="secondary">Continue setup</ButtonLink></div></section> : null}

    <section className="ui-panel overflow-hidden p-5 text-white sm:p-7" aria-labelledby="next-action-heading">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">What should I do next?</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5"><div><h2 id="next-action-heading" className="text-2xl font-bold">Run My Books</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Your weekly routine gathers only the transaction, receipt, payment, Owner Money, payroll, and reconciliation exceptions that need you.</p><p className="mt-3 text-sm font-bold text-brand-teal">{routineScale(routineCount)}</p></div><ButtonLink className="min-h-12 px-5" href={`${basePath}/review`}>Run My Books</ButtonLink></div>
    </section>

    <section aria-labelledby="attention-heading" className="owner-attention-zone">
      <div className="owner-section-heading"><div><p>What needs your attention</p><h2 id="attention-heading">Handle exceptions, not dashboards</h2></div><span>{attentionCount} active {attentionCount === 1 ? "item" : "items"}</span></div>
      {calm ? <div className="owner-calm-state"><span aria-hidden="true">✓</span><div><h3>You&apos;re caught up.</h3><p>No owner decisions are waiting. Use + New when business activity happens.</p></div></div> : <div className="grid gap-5 lg:grid-cols-2">
        <AttentionGroup title="Needs you now" description="Decisions currently blocking clean books." items={needsNow} basePath={basePath} />
        <AttentionGroup title="Coming up" description="Periodic work that should stay on your radar." items={comingUp} basePath={basePath} />
      </div>}
    </section>

    <QuickOwnerActions basePath={basePath} />

    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle py-5 text-sm text-text-muted"><p>New here? Learn the daily, weekly, monthly, and year-end routine on one screen.</p><Link className="ui-link font-bold" href={`${basePath}/help`}>How to run your books →</Link></footer>
  </section>;
}

function BookStatus({ dashboard, basePath }: { dashboard: TodayDashboard; basePath: "/app" | "/demo" }) {
  const blocker = dashboard.booksCurrent.blocker;
  const established = Boolean(dashboard.booksCurrent.date);
  const headline = blocker ? `${blocker.count} ${blocker.count === 1 ? "item is" : "items are"} blocking ${blocker.date}` : established ? "You’re caught up" : "Finish setup to establish this date";
  const blockerHref = blocker?.label.toLowerCase().includes("reconcil") ? `${basePath}/money/reconciliations` : blocker?.label.toLowerCase().includes("document") ? `${basePath}/documents` : established && basePath === "/app" ? "/app/taxes/close" : basePath === "/app" ? "/app/onboarding" : "/demo/money/reconciliations";
  return <section className="book-status-stage" aria-labelledby="books-current-heading"><div><p>Books current through</p><h2 id="books-current-heading">{dashboard.booksCurrent.date ?? "Not established yet"}</h2><span className={blocker || !established ? "is-blocked" : "is-clear"}>{blocker ? "Action needed" : established ? "Current" : "Setup needed"}</span></div><div><p className="book-status-explanation">{headline}</p><ButtonLink href={blockerHref} tone={blocker || !established ? "primary" : "secondary"}>{blocker ? "Review what’s blocking" : established ? "Month-end status" : "Continue setup"}</ButtonLink>{dashboard.booksCurrent.accountCoverage.length ? <details className="mt-3 text-xs text-text-muted"><summary className="cursor-pointer font-bold">Account coverage</summary><p className="mt-2">{dashboard.booksCurrent.accountCoverage.map((item) => `${item.accountName}: ${item.reconciledThrough ?? "reconciliation needed"}`).join(" · ")}</p></details> : null}</div></section>;
}

function QuickOwnerActions({ basePath }: { basePath: "/app" | "/demo" }) {
  const actions = basePath === "/app" ? [
    ["Create invoice", "Bill a customer", `${basePath}/money/invoices?new=invoice`],
    ["Add bill", "Record what the business owes", `${basePath}/money/bills?new=bill`],
    ["Add receipt", "Capture supporting evidence", `${basePath}/documents#document-upload`],
    ["Record mileage", "Log a business trip", `${basePath}/taxes/mileage#record-trip`],
  ] : [
    ["Add receipt", "Capture supporting evidence", "/demo/documents#document-upload"],
    ["Record owner-paid expense", "Prepare reimbursement work", "/demo/taxes/owner-money?new=expense#personally-paid-expense"],
    ["Import transactions", "Bring in fictional bank activity", "/demo/money/import"],
  ];
  return <section aria-labelledby="quick-actions-heading"><div className="owner-section-heading"><div><p>Quick things to record</p><h2 id="quick-actions-heading">As business happens</h2></div><span>More actions in + New</span></div><nav aria-label="Quick owner actions" className="owner-quick-actions">{actions.map(([label, detail, href]) => <Link href={href} key={label}><span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">→</span></Link>)}</nav></section>;
}

function AttentionGroup({ title, description, items, basePath }: { title: string; description: string; items: TodayDashboard["attention"]; basePath: "/app" | "/demo" }) {
  return <section className="owner-attention-group"><div><h3>{title}</h3><p>{description}</p></div>{items.length ? <ol>{items.map((item) => <li key={item.id}><Link href={attentionHref(item, basePath)}><span className={`owner-attention-count is-${item.tone}`}>{item.count}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><span aria-hidden="true">→</span></Link></li>)}</ol> : <div className="owner-attention-empty"><span aria-hidden="true">✓</span><p>Nothing in this group needs action.</p></div>}</section>;
}

function attentionHref(item: TodayDashboard["attention"][number], basePath: "/app" | "/demo") {
  if (item.id === "reconciliations") return `${basePath}/money/reconciliations`;
  return `${basePath}/${item.destination}`;
}
