import Link from "next/link";

import type { MoneyDashboard } from "@/lib/data/money-dashboard";
import type { MoneyOperationsSummary } from "@/lib/data/money-operations";

import { AccountingNav } from "./accounting-nav";
import { ButtonLink, EmptyState, PageHeader, StatusBadge } from "./ui";

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
  operations,
  canManageCpa = false,
  basePath,
}: {
  dashboard: MoneyDashboard;
  operations?: MoneyOperationsSummary;
  canManageCpa?: boolean;
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
      <AccountingNav basePath={basePath} active="overview" />
      <PageHeader
        eyebrow="Money workspace"
        title="Financial operations"
        description="See what is moving, what is owed, and where to act next. Every workflow keeps the existing protected accounting decisions in place."
        action={<div className="flex flex-wrap items-center gap-3"><StatusBadge tone="warning">{dashboard.summary.awaitingReviewCount} awaiting review</StatusBadge><ButtonLink href={`${basePath}/money/import`} tone="secondary">Import transactions</ButtonLink><ButtonLink href={`${basePath}/money/new`}>Add transaction</ButtonLink></div>}
      />

      {operations ? <OperationsHub basePath={basePath} operations={operations} canManageCpa={canManageCpa} /> : null}

      <section
        aria-label="Money review summary"
        className="workspace-summary ui-panel overflow-hidden text-white"
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

      <form className="workspace-filter ui-card p-4 sm:p-5" method="get">
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
              <Select label="Status" name="status" value={dashboard.filters.status} options={["PENDING_REVIEW", "APPROVED", "EXCLUDED", "CORRECTED", "VOIDED"]} />
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

      <section className="data-table-shell ui-card overflow-hidden">
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
          <EmptyState title={hasFilters ? "No transactions match" : "No transactions yet."}>
            {hasFilters ? "Clear a filter or search a different description, merchant, or source reference." : <><span>Record the first transaction for this account.</span><ButtonLink className="mt-4" href={`${basePath}/money/new`}>Add transaction</ButtonLink></>}
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

function OperationsHub({
  basePath,
  operations,
  canManageCpa,
}: {
  basePath: "/app" | "/demo";
  operations: MoneyOperationsSummary;
  canManageCpa: boolean;
}) {
  const invoiceDetail = operations.invoices.openCount
    ? `${operations.invoices.openCount} open${operations.invoices.overdueCount ? ` · ${operations.invoices.overdueCount} overdue` : ""}`
    : "No invoices yet";
  const billDetail = operations.bills.dueCount
    ? `${operations.bills.dueCount} open${operations.bills.upcomingCount ? ` · ${operations.bills.upcomingCount} upcoming` : ""}`
    : "No bills entered";
  const mileageDetail = operations.mileage.tripCount
    ? `${operations.mileage.tripCount} trips${operations.mileage.unclaimedCount ? ` · ${operations.mileage.unclaimedCount} to reimburse` : ""}`
    : "Record a substantiated business trip";
  const bankDetail = operations.bank.connectionCount
    ? `${operations.bank.connectionCount} connected institution${operations.bank.connectionCount === 1 ? "" : "s"}`
    : "Live provider not configured · CSV available";
  const cpaDetail = operations.cpa.acceptedCount
    ? `${operations.cpa.acceptedCount} read-only reviewer${operations.cpa.pendingCount ? ` · ${operations.cpa.pendingCount} invite pending` : ""}`
    : operations.cpa.pendingCount
      ? `${operations.cpa.pendingCount} secure invitation pending`
      : "No CPA currently has access";

  return (
    <section className="money-operations" aria-labelledby="money-operations-heading">
      <div className="money-operations-heading">
        <div>
          <p>Money overview</p>
          <h2 id="money-operations-heading">Run the financial work</h2>
        </div>
        <p>Clear paths for activity, customer payments, payables, and owner decisions.</p>
      </div>
      <div className="money-operations-grid">
        <OperationGroup title="Accounts and activity" description="Bring in and review business activity.">
          <OperationLink href={`${basePath}/money`} label="Review activity" detail={`${operations.invoices.openCount + operations.bills.dueCount} open customer or vendor item${operations.invoices.openCount + operations.bills.dueCount === 1 ? "" : "s"} alongside transactions`} />
          <OperationLink href={`${basePath}/money/import`} label="Import CSV" detail="Available now · review before posting" />
          <OperationLink href={`${basePath}/money/bank`} label="Bank connections" detail={bankDetail} />
        </OperationGroup>
        <OperationGroup title="Get paid" description="Create customer invoices and follow payment status.">
          <OperationLink href={`${basePath}/money/invoices`} label="Invoices" amount={`$${operations.invoices.openAmount}`} detail={invoiceDetail} action={operations.invoices.openCount ? "View invoices" : "Create invoice"} />
          <OperationLink href={`${basePath}/reports/operations?report=ar-aging`} label="Open receivables" detail="See what customers still owe" action="View AR aging" />
        </OperationGroup>
        <OperationGroup title="Payables" description="Track what the business owes without double-recording expenses.">
          <OperationLink href={`${basePath}/money/bills`} label="Bills" amount={`$${operations.bills.dueAmount}`} detail={billDetail} action={operations.bills.dueCount ? "View bills" : "Add bill"} />
          <OperationLink href={`${basePath}/reports/operations?report=ap-aging`} label="Open payables" detail="See upcoming and overdue vendor obligations" action="View AP aging" />
        </OperationGroup>
        <OperationGroup title="Owner and professional review" description="Keep S-Corp treatments distinct and review-ready.">
          <OperationLink href={`${basePath}/taxes/owner-money`} label="Owner Money" detail="Salary, distributions, reimbursements, contributions, and loans stay separate" action="Open Owner Money" />
          <OperationLink href={`${basePath}/taxes/mileage`} label="Mileage" amount={`${operations.mileage.milesThisYear} mi`} detail={mileageDetail} action={operations.mileage.tripCount ? "View mileage" : "Record trip"} />
          {canManageCpa ? <OperationLink href={`${basePath}/settings/cpa`} label="CPA access" detail={cpaDetail} action={operations.cpa.acceptedCount || operations.cpa.pendingCount ? "Manage CPA access" : "Invite CPA"} /> : null}
        </OperationGroup>
      </div>
    </section>
  );
}

function OperationGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="money-operation-group"><div><p>{title}</p><span>{description}</span></div><div>{children}</div></section>;
}

function OperationLink({ href, label, detail, amount, action }: { href: string; label: string; detail: string; amount?: string; action?: string }) {
  return <Link href={href} className="money-operation-link"><span><strong>{label}</strong><small>{detail}</small></span><span className="money-operation-link-end">{amount ? <b className="money-value">{amount}</b> : null}<em>{action ?? "Open"} <span aria-hidden="true">→</span></em></span></Link>;
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
