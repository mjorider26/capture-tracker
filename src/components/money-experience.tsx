import Link from "next/link";

import type { MoneyDashboard } from "@/lib/data/money-dashboard";

import { AccountingNav } from "./accounting-nav";
import { EmptyState, PageHeader, StatusBadge } from "./ui";

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

export function MoneyExperience({
  dashboard,
  basePath,
}: {
  dashboard: MoneyDashboard;
  basePath: "/app" | "/demo";
}) {
  const hasFilters = Boolean(
    dashboard.filters.query ||
      dashboard.filters.status ||
      dashboard.filters.intent ||
      dashboard.filters.accountId,
  );

  return (
    <section className="space-y-7">
      <AccountingNav basePath={basePath} active="transactions" />
      <PageHeader
        eyebrow="Money workspace"
        title="Transaction review"
        description="Review current activity and evidence before any accounting decision. Posted records remain protected."
        action={
          <StatusBadge tone="warning">
            {dashboard.summary.awaitingReviewCount} awaiting review
          </StatusBadge>
        }
      />

      <section
        aria-label="Money review summary"
        className="ui-panel overflow-hidden bg-brand-navy text-white"
      >
        <div className="grid divide-y divide-white/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Summary
            label="Awaiting review"
            value={String(dashboard.summary.awaitingReviewCount)}
            detail="Transactions pending a decision"
            emphasis
          />
          <Summary
            label="Reviewed business"
            value={dashboard.summary.reviewedBusinessAmount}
            detail="Approved transaction amounts"
          />
          <Summary
            label="Excluded personal"
            value={dashboard.summary.excludedPersonalAmount}
            detail="Personal transaction amounts"
          />
          <Summary
            label="Mixed transactions"
            value={String(dashboard.summary.mixedCount)}
            detail={`${dashboard.summary.accountCount} active financial accounts`}
          />
        </div>
      </section>

      <form className="ui-card p-4 sm:p-5" method="get">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-text-primary">Find transactions</p>
            <p className="mt-1 text-xs text-text-muted">
              Filters apply only to this business and do not alter records.
            </p>
          </div>
          {hasFilters && (
            <Link
              className="text-sm font-bold text-brand-teal underline underline-offset-4"
              href={`${basePath}/money`}
            >
              Clear filters
            </Link>
          )}
        </div>
        <div className="mt-4 min-[720px]:grid min-[720px]:grid-cols-2 min-[720px]:gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <label className="text-sm font-bold text-text-muted">
            Search
            <input
              name="q"
              defaultValue={dashboard.filters.query}
              className="ui-input mt-1"
              placeholder="Description, merchant, or reference"
            />
          </label>
          <details className="mt-3 min-[720px]:contents" open={hasFilters || undefined}>
            <summary className="min-h-11 cursor-pointer rounded-[var(--radius-sm)] border border-border-subtle px-4 py-3 text-sm font-bold text-brand-navy min-[720px]:hidden">Filters{hasFilters ? " (active)" : ""}</summary>
            <div className="mt-3 grid gap-3 min-[720px]:contents">
              <Select label="Status" name="status" value={dashboard.filters.status} options={["PENDING_REVIEW", "APPROVED", "EXCLUDED", "VOIDED"]} />
              <Select label="Intent" name="intent" value={dashboard.filters.intent} options={["UNREVIEWED", "BUSINESS", "PERSONAL", "MIXED"]} />
              <label className="text-sm font-bold text-text-muted">
                Account
                <select name="account" defaultValue={dashboard.filters.accountId} className="ui-input mt-1">
                  <option value="">All accounts</option>
                  {dashboard.accounts.map((account) => (
                    <option value={account.id} key={account.id}>{account.name}</option>
                  ))}
                </select>
              </label>
              <button className="min-h-11 self-end rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--brand-navy-strong)]">
                Apply filters
              </button>
            </div>
          </details>
        </div>
      </form>

      <section className="ui-card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-text-primary">Transactions</h2>
            <p className="mt-1 text-xs text-text-muted">
              Most recent first. Review status and evidence are shown without changing the ledger.
            </p>
          </div>
          <span className="ui-status-badge bg-surface-secondary text-text-muted">
            {dashboard.summary.resultCount} shown
          </span>
        </div>
        {dashboard.transactions.length === 0 ? (
          <EmptyState title="No transactions match">
            Clear a filter or search a different description, merchant, or source reference.
          </EmptyState>
        ) : (
          <>
            <div className="divide-y divide-border-subtle min-[720px]:hidden">
              {dashboard.transactions.map((transaction) => (
                <TransactionCard key={transaction.id} transaction={transaction} basePath={basePath} />
              ))}
            </div>
            <table className="hidden w-full text-left text-sm min-[720px]:table">
              <thead className="bg-surface-secondary text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Date</th>
                  <th className="px-5 py-3 font-bold">Transaction</th>
                  <th className="px-5 py-3 font-bold">Evidence</th>
                  <th className="px-5 py-3 font-bold">Review</th>
                  <th className="px-5 py-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-border-subtle transition-colors hover:bg-surface-secondary/60">
                    <td className="whitespace-nowrap px-5 py-4 text-text-muted">{date(transaction.postedAt)}</td>
                    <td className="min-w-64 px-5 py-4">
                      <Link className="font-bold text-brand-navy underline decoration-brand-teal underline-offset-4" href={`${basePath}/money/${transaction.id}`}>
                        {transaction.description}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--text-subtle)]">
                        {transaction.accountName} / {transaction.accountOwnership.toLowerCase()} account
                      </p>
                    </td>
                    <td className="px-5 py-4"><Evidence transaction={transaction} /></td>
                    <td className="px-5 py-4"><State transaction={transaction} /></td>
                    <td className="money-value whitespace-nowrap px-5 py-4 text-right font-bold text-text-primary">
                      {transaction.direction === "OUTFLOW" ? "-" : "+"}{transaction.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </section>
  );
}

function Summary({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }) {
  return (
    <div className="min-h-32 p-5 sm:p-6">
      <p className="text-sm font-bold text-white/70">{label}</p>
      <p className={`money-value mt-4 text-3xl font-bold tracking-[-0.04em] ${emphasis ? "text-[var(--brand-teal)]" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/65">{detail}</p>
    </div>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: string[] }) {
  return (
    <label className="text-sm font-bold text-text-muted">
      {label}
      <select name={name} defaultValue={value} className="ui-input mt-1">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
      </select>
    </label>
  );
}

function Evidence({ transaction }: { transaction: MoneyDashboard["transactions"][number] }) {
  return <StatusBadge tone={transaction.hasDocuments ? "success" : "neutral"}>{transaction.hasDocuments ? "Document linked" : "No document"}</StatusBadge>;
}

function State({ transaction }: { transaction: MoneyDashboard["transactions"][number] }) {
  const tone = transaction.isLocked ? "locked" : transaction.status === "PENDING_REVIEW" ? "warning" : transaction.status === "EXCLUDED" ? "neutral" : "success";
  return (
    <div className="space-y-1">
      <StatusBadge tone={tone}>{transaction.status.replaceAll("_", " ")}</StatusBadge>
      <p className="text-xs text-text-muted">
        {transaction.intent}{transaction.isLocked ? " / locked" : transaction.isMixed ? " / split" : ""}
      </p>
    </div>
  );
}

function TransactionCard({ transaction, basePath }: { transaction: MoneyDashboard["transactions"][number]; basePath: "/app" | "/demo" }) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <Link className="font-bold text-brand-navy underline decoration-brand-teal underline-offset-4" href={`${basePath}/money/${transaction.id}`}>{transaction.description}</Link>
          <p className="mt-1 text-xs text-text-muted">{date(transaction.postedAt)} / {transaction.accountName}</p>
        </div>
        <p className="money-value shrink-0 font-bold text-text-primary">{transaction.direction === "OUTFLOW" ? "-" : "+"}{transaction.amount}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><Evidence transaction={transaction} /><State transaction={transaction} /></div>
    </article>
  );
}
