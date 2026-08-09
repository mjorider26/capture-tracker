import Link from "next/link";

import type { getFinancialReports } from "@/lib/data/reports";

type Reports = Awaited<ReturnType<typeof getFinancialReports>>;

export function FinancialReports({
  reports,
  basePath,
  focus = "overview",
}: {
  reports: Reports;
  basePath: "/app" | "/demo";
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
