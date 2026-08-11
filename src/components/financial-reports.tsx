import Link from "next/link";

import type { getFinancialReports } from "@/lib/data/reports";

type Reports = Awaited<ReturnType<typeof getFinancialReports>>;

export function FinancialReports({
  reports,
  basePath,
  focus = "overview",
  canManageCpa = false,
}: {
  reports: Reports;
  basePath: "/app" | "/demo";
  canManageCpa?: boolean;
  focus?:
    | "overview"
    | "profit-and-loss"
    | "balance-sheet"
    | "trial-balance"
    | "cash-activity";
}) {
  const links = [
    ["overview", "Overview"],
    ["profit-and-loss", "Profit and Loss"],
    ["balance-sheet", "Balance Sheet"],
    ["trial-balance", "Trial Balance"],
    ["cash-activity", "Cash Activity"],
  ] as const;
  const money = (value: string) => `$${value}`;
  const exportKind = focus === "overview" ? "trial-balance" : focus;
  const query = `period=${reports.range.period}&start=${reports.range.start.slice(0, 10)}&end=${reports.range.end.slice(0, 10)}&kind=${exportKind}`;

  return (
    <>
      <header className="ui-page-header">
        <p className="ui-page-eyebrow font-bold uppercase">Ledger-backed reports</p>
        <h1 className="ui-page-title mt-2 text-3xl font-bold tracking-[-0.055em]">
          Financial reports
        </h1>
        <p className="ui-page-description mt-3 text-sm text-text-muted">
          {reports.range.label}. Posted journal entries are the source of truth.
        </p>
      </header>
      <nav className="report-tabs flex gap-2 overflow-x-auto" aria-label="Report views">
        {links.map(([key, label]) => (
          <Link
            key={key}
            className={`min-h-10 shrink-0 rounded px-3 py-2 text-sm font-bold ${focus === key ? "bg-brand-navy text-white" : "bg-surface-secondary text-text-muted"}`}
            href={`${basePath}/reports${key === "overview" ? "" : `/${key}`}`}
          >
            {label}
          </Link>
        ))}
        {basePath === "/app" && <Link className="min-h-10 shrink-0 rounded bg-surface-secondary px-3 py-2 text-sm font-bold text-text-muted" href="/app/reports/operations">Operations</Link>}
      </nav>
      {basePath === "/app" && <GuidedReportLibrary canManageCpa={canManageCpa} />}
      <form className="workspace-filter mt-4 flex flex-wrap gap-2 rounded-[var(--radius-md)] p-3" method="get">
        <select className="ui-input w-auto" name="period" defaultValue={reports.range.period}>
          <option value="month">This month</option>
          <option value="last-month">Last month</option>
          <option value="quarter">This quarter</option>
          <option value="ytd">Year to date</option>
          <option value="previous-year">Previous year</option>
          <option value="custom">Custom dates</option>
        </select>
        <input className="ui-input w-auto" name="start" type="date" defaultValue={reports.range.start.slice(0, 10)} />
        <input className="ui-input w-auto" name="end" type="date" defaultValue={reports.range.end.slice(0, 10)} />
        <button className="ui-button ui-button-secondary min-h-10 rounded border border-border-subtle px-3 text-sm font-bold">
          Apply period
        </button>
        {basePath === "/app" && <>
          <a className="ui-button ui-button-secondary min-h-10 rounded border border-border-subtle px-3 py-2 text-sm font-bold" href={`/api/reports/csv?${query}`}>
            Export CSV
          </a>
          <a className="ui-button ui-button-secondary min-h-10 rounded border border-border-subtle px-3 py-2 text-sm font-bold" href={`/api/cpa-package?period=${reports.range.period}&start=${reports.range.start.slice(0, 10)}&end=${reports.range.end.slice(0, 10)}`}>
            Download CPA package
          </a>
        </>}
      </form>
      {(focus === "overview" || focus === "profit-and-loss") && (
        <ReportTable title="Profit and Loss" report="profit-and-loss" rows={[...reports.profitAndLoss.income, ...reports.profitAndLoss.expenses]} basePath={basePath} range={reports.range} totals={["Total income", reports.profitAndLoss.totalIncome, "Total expenses", reports.profitAndLoss.totalExpenses, "Net income", reports.profitAndLoss.netIncome]} />
      )}
      {(focus === "overview" || focus === "balance-sheet") && (
        <ReportTable title="Balance Sheet" report="balance-sheet" rows={[...reports.balanceSheet.assets, ...reports.balanceSheet.liabilities, ...reports.balanceSheet.equity]} basePath={basePath} range={reports.range} totals={["Assets", reports.balanceSheet.totalAssets, "Liabilities and equity", reports.balanceSheet.totalLiabilitiesAndEquity, "Difference", reports.balanceSheet.difference]} />
      )}
      {(focus === "overview" || focus === "trial-balance") && (
        <ReportTable title="Trial Balance" report="trial-balance" rows={reports.trialBalance.rows} basePath={basePath} range={reports.range} totals={["Debits", reports.trialBalance.totalDebits, "Credits", reports.trialBalance.totalCredits, "Difference", reports.trialBalance.difference]} />
      )}
      {(focus === "overview" || focus === "cash-activity") && (
        <section className="metric-card ui-card mt-6 p-5">
          <h2 className="text-lg font-bold">Cash activity summary</h2>
          <p className="mt-1 text-sm text-text-muted">Not a formal GAAP statement of cash flows.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-5">
            {[["Opening cash", reports.cashActivity.openingCash], ["Inflows", reports.cashActivity.inflows], ["Outflows", reports.cashActivity.outflows], ["Net change", reports.cashActivity.netChange], ["Ending cash", reports.cashActivity.endingCash]].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-bold text-text-muted">{label}</dt>
                <dd className="money-value mt-1 font-bold">{money(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function GuidedReportLibrary({ canManageCpa }: { canManageCpa: boolean }) {
  const groups = [
    { question: "How is my business doing?", detail: "The primary financial statements for income, expenses, assets, liabilities, and equity.", links: [["Profit & Loss", "/app/reports/profit-and-loss", "Income, expenses, and net income for the selected period."], ["Balance Sheet", "/app/reports/balance-sheet", "What the business owns, owes, and retains at the report date."]] },
    { question: "Who owes me money?", detail: "Customer invoices and receivables.", links: [["Open invoices", "/app/reports/operations?report=open-invoices", "Customer balances that remain unpaid."], ["AR Aging", "/app/reports/operations?report=ar-aging", "What customers owe, grouped by how long it has been outstanding."], ["Invoice payments", "/app/reports/operations?report=invoice-payments", "Recorded incoming payments and supporting bank evidence."]] },
    { question: "What do I owe?", detail: "Vendor bills and payables.", links: [["Open bills", "/app/reports/operations?report=open-bills", "Vendor obligations that remain unpaid."], ["AP Aging", "/app/reports/operations?report=ap-aging", "What the business owes, grouped by how long it has been outstanding."], ["Bill payments", "/app/reports/operations?report=bill-payments", "Recorded outgoing payments and supporting bank evidence."]] },
    { question: "What happened in my books?", detail: "Accounting detail remains available when you need to trace the ledger.", links: [["General Ledger", "/app/money/journal", "Immutable posted journal activity and accounting evidence."], ["Trial Balance", "/app/reports/trial-balance", "Debit and credit balances that must remain equal."], ["Transaction detail", "/app/money", "Reviewed activity, classifications, documents, and corrections."]] },
    { question: "Me & my S-Corp", detail: "Keep owner transactions and workpapers distinct.", links: [["Owner Money", "/app/taxes/owner-money", "Salary, distributions, reimbursements, contributions, and loans."], ["Basis workpapers", "/app/taxes/owner-money/s-corp", "Stock basis, debt basis, benefits, and distribution readiness evidence."], ["Mileage", "/app/reports/operations?report=mileage-log", "Business trips and reimbursement status."], ["Mileage reimbursements", "/app/reports/operations?report=mileage-reimbursements", "Trips included in or still waiting for reimbursement work."], ["Payroll workpapers", "/app/taxes/payroll", "Recorded payroll-provider facts and accounting evidence."]] },
    { question: "CPA / year-end", detail: "Finish deterministic bookkeeping checks and prepare a professional handoff.", links: [["Year-End Flight Check", "/app/taxes/year-end", "Issues that must be resolved before CPA handoff."], ["CPA access", "/app/settings/cpa", "Invite and manage a secure read-only professional reviewer."], ["CPA package", "/app/reports", "Download tenant-scoped schedules and a PDF index below."]] },
  ];
  const ownerOnlyLinks = new Set(["CPA access", "Owner Money", "Basis workpapers"]);

  return <section className="guided-report-library mt-5" aria-labelledby="guided-reports-heading"><div className="owner-section-heading"><div><p>Reports by question</p><h2 id="guided-reports-heading">Start with what you need to know</h2></div><span>Accounting names stay visible</span></div><div>{groups.map((group) => <section key={group.question} className="guided-report-group"><div><h3>{group.question}</h3><p>{group.detail}</p></div><div>{group.links.filter(([label]) => canManageCpa || !ownerOnlyLinks.has(label)).map(([label, href, description]) => <Link key={`${label}-${href}`} href={href}><span><strong>{label}</strong><small>{description}</small></span><span aria-hidden="true">→</span></Link>)}</div></section>)}</div></section>;
}

function ReportTable({
  title,
  report,
  rows,
  basePath,
  range,
  totals,
}: {
  title: string;
  report: "profit-and-loss" | "balance-sheet" | "trial-balance";
  rows: Array<{ accountId: string; code: string; name: string; type: string; debit: string; credit: string; balance: string; entryCount: number }>;
  basePath: "/app" | "/demo";
  range: Reports["range"];
  totals: [string, string, string, string, string, string];
}) {
  return (
    <section className="data-table-shell ui-card mt-6 overflow-x-auto">
      <div className="p-5"><h2 className="text-lg font-bold">{title}</h2></div>
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="border-y border-border-subtle text-left text-text-muted">
          <tr><th className="p-3">Account</th><th className="p-3">Type</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Balance</th><th className="p-3">Evidence</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.type}-${row.code}`} className="border-b border-border-subtle">
              <td className="p-3 font-bold">{row.code} · {row.name}</td><td className="p-3">{row.type}</td><td className="money-value p-3 text-right">${row.debit}</td><td className="money-value p-3 text-right">${row.credit}</td><td className="money-value p-3 text-right">${row.balance}</td>
              <td className="p-3">{row.entryCount > 0 && <Link className="ui-link" href={`${basePath}/reports/${report}/${row.accountId}?period=${range.period}&start=${range.start.slice(0, 10)}&end=${range.end.slice(0, 10)}`}>View {row.entryCount} {row.entryCount === 1 ? "line" : "lines"}</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-2 border-t border-border-subtle p-5 text-sm sm:grid-cols-3">
        {[[totals[0], totals[1]], [totals[2], totals[3]], [totals[4], totals[5]]].map(([label, value]) => <p key={label} className="flex justify-between gap-3"><span className="font-bold">{label}</span><span className="money-value">${value}</span></p>)}
      </div>
    </section>
  );
}
