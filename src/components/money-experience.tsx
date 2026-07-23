import Link from "next/link";

import type { MoneyDashboard } from "@/lib/data/money-dashboard";

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
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#155eef]">Money</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Transaction review
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63738a]">
            Review unposted activity without changing posted accounting.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#63738a] shadow-sm ring-1 ring-[#dce5f0]">
          {dashboard.summary.resultCount} shown
        </span>
      </header>
      <section
        aria-label="Money summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Summary
          label="Awaiting review"
          value={String(dashboard.summary.awaitingReviewCount)}
          detail="Transactions pending a decision"
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
        className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dce5f0] md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
        method="get"
      >
        <label className="text-sm font-semibold text-[#51627a]">
          Search
          <input
            name="q"
            defaultValue={dashboard.filters.query}
            className="mt-1 min-h-11 w-full rounded-xl border border-[#cbd7e6] px-3 text-[#10233f]"
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
        <label className="text-sm font-semibold text-[#51627a]">
          Account
          <select
            name="account"
            defaultValue={dashboard.filters.accountId}
            className="mt-1 min-h-11 w-full rounded-xl border border-[#cbd7e6] bg-white px-3 text-[#10233f]"
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
          <button className="min-h-11 rounded-xl bg-[#155eef] px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12b8c8]">
            Filter
          </button>
          {hasFilters && (
            <Link
              className="grid min-h-11 place-items-center rounded-xl px-3 text-sm font-semibold text-[#155eef] underline"
              href={`${basePath}/money`}
            >
              Reset
            </Link>
          )}
        </div>
      </form>
      <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#dce5f0]">
        <div className="border-b border-[#edf1f6] px-5 py-4">
          <h2 className="font-bold">Transactions</h2>
          <p className="mt-1 text-xs text-[#6c7b90]">
            Most recent first. Posted and reviewed records remain read-only.
          </p>
        </div>
        {dashboard.transactions.length === 0 ? (
          <p className="p-6 text-sm text-[#63738a]">
            No transactions match these filters.
          </p>
        ) : (
          <>
            <div className="divide-y divide-[#edf1f6] md:hidden">
              {dashboard.transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  basePath={basePath}
                />
              ))}
            </div>
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="bg-[#f8faff] text-xs uppercase tracking-wide text-[#6c7b90]">
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
                    className="border-t border-[#edf1f6]"
                  >
                    <td className="px-5 py-4 text-[#63738a]">
                      {date(transaction.postedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-semibold text-[#155eef] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12b8c8]"
                        href={`${basePath}/money/${transaction.id}`}
                      >
                        {transaction.description}
                      </Link>
                      <p className="mt-1 text-xs text-[#6c7b90]">
                        {transaction.accountName} ·{" "}
                        {transaction.accountOwnership.toLowerCase()} account
                        {transaction.hasDocuments ? " · document attached" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <State transaction={transaction} />
                    </td>
                    <td className="px-5 py-4 text-right font-bold">
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
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-h-32 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0]">
      <p className="text-sm font-semibold text-[#51627a]">{label}</p>
      <p className="mt-4 text-2xl font-bold tracking-tight text-[#10233f]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#6c7b90]">{detail}</p>
    </article>
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
    <label className="text-sm font-semibold text-[#51627a]">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="mt-1 min-h-11 w-full rounded-xl border border-[#cbd7e6] bg-white px-3 text-[#10233f]"
      >
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
  return (
    <div className="space-y-1">
      <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-bold text-[#155eef]">
        {transaction.status.replaceAll("_", " ")}
      </span>
      <p className="text-xs text-[#63738a]">
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
            className="font-semibold text-[#155eef] underline"
            href={`${basePath}/money/${transaction.id}`}
          >
            {transaction.description}
          </Link>
          <p className="mt-1 text-xs text-[#6c7b90]">
            {date(transaction.postedAt)} · {transaction.accountName}
          </p>
        </div>
        <p className="shrink-0 font-bold">
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
