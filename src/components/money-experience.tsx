import Link from "next/link";

import type { MoneyDashboard } from "@/lib/data/money-dashboard";

import { Card, EmptyState, PageHeader, StatusBadge } from "./ui";

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
    <>
      <PageHeader
        eyebrow="Money"
        title="Transaction review"
        description="Review unposted activity without changing posted accounting."
        action={
          <StatusBadge tone="warning">
            {dashboard.summary.awaitingReviewCount} awaiting review
          </StatusBadge>
        }
      />
      <section
        aria-label="Money summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
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
      </section>
      <form
        className="ui-card mt-7 grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
        method="get"
      >
        <label className="text-sm font-bold text-text-muted">
          Search
          <input
            name="q"
            defaultValue={dashboard.filters.query}
            className="ui-input mt-1"
            placeholder="Description, merchant, or reference"
          />
        </label>
        <Select
          label="Status"
          name="status"
          value={dashboard.filters.status}
          options={["PENDING_REVIEW", "APPROVED", "EXCLUDED", "VOIDED"]}
        />
        <Select
          label="Intent"
          name="intent"
          value={dashboard.filters.intent}
          options={["UNREVIEWED", "BUSINESS", "PERSONAL", "MIXED"]}
        />
        <label className="text-sm font-bold text-text-muted">
          Account
          <select
            name="account"
            defaultValue={dashboard.filters.accountId}
            className="ui-input mt-1"
          >
            <option value="">All accounts</option>
            {dashboard.accounts.map((account) => (
              <option value={account.id} key={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white">
            Apply filters
          </button>
          {hasFilters && (
            <Link
              className="grid min-h-11 place-items-center rounded-[var(--radius-sm)] px-3 text-sm font-bold text-brand-teal underline"
              href={`${basePath}/money`}
            >
              Reset
            </Link>
          )}
        </div>
      </form>
      <section className="ui-card mt-7 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div>
            <h2 className="font-bold">Transactions</h2>
            <p className="mt-1 text-xs text-text-muted">
              Most recent first. Posted and reviewed records remain read-only.
            </p>
          </div>
          <span className="text-xs font-bold text-text-muted">
            {dashboard.summary.resultCount} shown
          </span>
        </div>
        {dashboard.transactions.length === 0 ? (
          <EmptyState title="No transactions match">
            Clear a filter or search a different description, merchant, or
            source reference.
          </EmptyState>
        ) : (
          <>
            <div className="divide-y divide-border-subtle md:hidden">
              {dashboard.transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  basePath={basePath}
                />
              ))}
            </div>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-t border-border-subtle"
                  >
                    <td className="px-5 py-4 text-text-muted">
                      {date(transaction.postedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-bold text-brand-navy underline decoration-[var(--brand-teal)] underline-offset-4"
                        href={`${basePath}/money/${transaction.id}`}
                      >
                        {transaction.description}
                      </Link>
                      <p className="mt-1 text-xs text-[var(--text-subtle)]">
                        {transaction.accountName} ·{" "}
                        {transaction.accountOwnership.toLowerCase()} account
                        {transaction.hasDocuments ? " · document attached" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <State transaction={transaction} />
                    </td>
                    <td className="money-value px-5 py-4 text-right font-bold">
                      {transaction.direction === "OUTFLOW" ? "−" : "+"}
                      {transaction.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}
function Summary({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <Card
      className={`min-h-32 p-5 ${emphasis ? "border-[var(--brand-teal)]" : ""}`}
    >
      <p className="text-sm font-bold text-text-muted">{label}</p>
      <p className="money-value mt-4 text-2xl font-bold tracking-[-0.03em] text-brand-navy">
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--text-subtle)]">{detail}</p>
    </Card>
  );
}
function Select({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: string[];
}) {
  return (
    <label className="text-sm font-bold text-text-muted">
      {label}
      <select name={name} defaultValue={value} className="ui-input mt-1">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
function State({
  transaction,
}: {
  transaction: MoneyDashboard["transactions"][number];
}) {
  const tone = transaction.isLocked
    ? "locked"
    : transaction.status === "PENDING_REVIEW"
      ? "warning"
      : transaction.status === "EXCLUDED"
        ? "neutral"
        : "success";
  return (
    <div className="space-y-1">
      <StatusBadge tone={tone}>
        {transaction.status.replaceAll("_", " ")}
      </StatusBadge>
      <p className="text-xs text-text-muted">
        {transaction.intent}
        {transaction.isLocked
          ? " · locked"
          : transaction.isMixed
            ? " · split"
            : ""}
      </p>
    </div>
  );
}
function TransactionCard({
  transaction,
  basePath,
}: {
  transaction: MoneyDashboard["transactions"][number];
  basePath: "/app" | "/demo";
}) {
  return (
    <article className="p-4">
      <div className="flex justify-between gap-4">
        <div>
          <Link
            className="font-bold text-brand-navy underline decoration-[var(--brand-teal)] underline-offset-4"
            href={`${basePath}/money/${transaction.id}`}
          >
            {transaction.description}
          </Link>
          <p className="mt-1 text-xs text-text-muted">
            {date(transaction.postedAt)} · {transaction.accountName}
          </p>
        </div>
        <p className="money-value shrink-0 font-bold">
          {transaction.direction === "OUTFLOW" ? "−" : "+"}
          {transaction.amount}
        </p>
      </div>
      <div className="mt-3">
        <State transaction={transaction} />
      </div>
    </article>
  );
}
