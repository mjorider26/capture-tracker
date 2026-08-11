import Link from "next/link";

import type { TodayDashboard } from "@/lib/data/today-dashboard";

import { ButtonLink, PageHeader, StatusBadge } from "./ui";

export function TodayExperience({ dashboard, basePath }: { dashboard: TodayDashboard; basePath: "/app" | "/demo" }) {
  const needsNow = dashboard.attention.filter((item) => ["transactions", "documents", "matches", "reconciliations"].includes(item.id));
  const comingUp = dashboard.attention.filter((item) => ["tax", "payroll", "reviewTasks"].includes(item.id));
  const calm = needsNow.length === 0 && comingUp.length === 0;
  const setupHref = basePath === "/app" ? "/app/onboarding" : "/demo/money/reconciliations";

  return <section className="space-y-7">
    <PageHeader eyebrow="Today" title="Your books, in order" description={`${dashboard.businessName}. Start here: Capture Tracker brings forward the bookkeeping decisions that need you and keeps completed work out of the way.`} action={<StatusBadge tone={calm ? "success" : "info"}>{calm ? "Caught up" : "Owner review"}</StatusBadge>} />

    <BookStatus dashboard={dashboard} basePath={basePath} />

    {dashboard.setup?.incomplete ? <section className="ui-card border border-status-warning p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Finish opening your books</p><p className="mt-1 max-w-2xl text-sm text-text-muted">Confirm opening facts and complete an exact-zero reconciliation before Capture Tracker can establish a current-through date.</p></div><ButtonLink href={setupHref} tone="secondary">Continue setup</ButtonLink></div></section> : null}

    <QuickOwnerActions basePath={basePath} />

    <section aria-labelledby="attention-heading" className="owner-attention-zone">
      <div className="owner-section-heading"><div><p>What needs your attention</p><h2 id="attention-heading">Work the exceptions, then move on</h2></div><span>{needsNow.length + comingUp.length} active {needsNow.length + comingUp.length === 1 ? "group" : "groups"}</span></div>
      {calm ? <div className="owner-calm-state"><span aria-hidden="true">✓</span><div><h3>You&apos;re caught up.</h3><p>No unresolved owner decisions are waiting here. Your frequent actions remain available above whenever new work arrives.</p></div></div> : <div className="grid gap-5 lg:grid-cols-2">
        <AttentionGroup title="Needs you now" description="Owner decisions that block clean books." items={needsNow} basePath={basePath} />
        <AttentionGroup title="Coming up" description="Review work that should stay on your radar." items={comingUp} basePath={basePath} />
      </div>}
    </section>

    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle py-5 text-sm text-text-muted"><p>Need the weekly rhythm? Work through every linked exception without hiding unresolved items.</p><Link className="ui-link font-bold" href={`${basePath}/review`}>Open Weekly Review →</Link></footer>
  </section>;
}

function BookStatus({ dashboard, basePath }: { dashboard: TodayDashboard; basePath: "/app" | "/demo" }) {
  const blocker = dashboard.booksCurrent.blocker;
  const established = Boolean(dashboard.booksCurrent.date);
  const blockerText = blocker ? `${blocker.count} ${blocker.count === 1 ? "item is" : "items are"} blocking ${blocker.date}` : established ? "All deterministic evidence checks are clear through the latest reconciled account coverage." : "Complete setup and initial reconciliation evidence before Capture Tracker can establish this date.";
  const blockerHref = blocker?.label.toLowerCase().includes("reconcil") ? `${basePath}/money/reconciliations` : blocker?.label.toLowerCase().includes("document") ? `${basePath}/documents` : established ? `${basePath}/money` : basePath === "/app" ? "/app/onboarding" : "/demo/money/reconciliations";
  return <section className="book-status-stage" aria-labelledby="books-current-heading">
    <div><p>Books current through</p><h2 id="books-current-heading">{dashboard.booksCurrent.date ?? "Not established yet"}</h2><span className={blocker || !established ? "is-blocked" : "is-clear"}>{blocker ? "Action needed" : established ? "Current" : "Setup needed"}</span></div>
    <div><p className="book-status-explanation">{blockerText}</p>{blocker || !established ? <ButtonLink href={blockerHref}>{blocker ? "Review blocker" : "Continue setup"}</ButtonLink> : <ButtonLink href={`${basePath}/taxes/close`} tone="secondary">How this date works</ButtonLink>}{dashboard.booksCurrent.accountCoverage.length ? <p className="book-status-coverage">{dashboard.booksCurrent.accountCoverage.map((item) => `${item.accountName}: ${item.reconciledThrough ?? "reconciliation needed"}`).join(" · ")}</p> : null}</div>
  </section>;
}

function QuickOwnerActions({ basePath }: { basePath: "/app" | "/demo" }) {
  const actions = basePath === "/app" ? [
    ["Review activity", "Clear transaction decisions", `${basePath}/money`],
    ["Add receipt", "Upload supporting evidence", `${basePath}/documents#document-upload`],
    ["Create invoice", "Get paid for your work", `${basePath}/money/invoices?new=invoice`],
    ["Add bill", "Track what the business owes", `${basePath}/money/bills?new=bill`],
    ["Record mileage", "Log a business trip", `${basePath}/taxes/mileage#record-trip`],
    ["Owner Money", "You and the S-Corp", `${basePath}/taxes/owner-money`],
  ] : [
    ["Review activity", "Clear transaction decisions", `${basePath}/money`],
    ["Add receipt", "Upload supporting evidence", `${basePath}/documents#document-upload`],
    ["View reports", "Read ledger-backed results", `${basePath}/reports`],
    ["Owner Money", "You and the S-Corp", `${basePath}/taxes/owner-money`],
  ];
  return <section aria-labelledby="quick-actions-heading"><div className="owner-section-heading"><div><p>Quick owner actions</p><h2 id="quick-actions-heading">What do you want to do?</h2></div><span>Frequent workflows</span></div><nav aria-label="Quick owner actions" className="owner-quick-actions">{actions.map(([label, detail, href]) => <Link href={href} key={label}><span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">→</span></Link>)}</nav></section>;
}

function AttentionGroup({ title, description, items, basePath }: { title: string; description: string; items: TodayDashboard["attention"]; basePath: "/app" | "/demo" }) {
  return <section className="owner-attention-group"><div><h3>{title}</h3><p>{description}</p></div>{items.length ? <ol>{items.map((item) => <li key={item.id}><Link href={attentionHref(item, basePath)}><span className={`owner-attention-count is-${item.tone}`}>{item.count}</span><span><strong>{item.label}</strong><small>{item.description}</small></span><span aria-hidden="true">→</span></Link></li>)}</ol> : <div className="owner-attention-empty"><span aria-hidden="true">✓</span><p>Nothing in this group needs action.</p></div>}</section>;
}

function attentionHref(item: TodayDashboard["attention"][number], basePath: "/app" | "/demo") {
  if (item.id === "reconciliations") return `${basePath}/money/reconciliations`;
  return `${basePath}/${item.destination}`;
}
