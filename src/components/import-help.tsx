import Link from "next/link";

export function ImportHelp() {
  return <section id="import-help" className="ui-card p-5 sm:p-6">
    <h2 className="text-lg font-bold">CSV format and examples</h2>
    <p className="mt-1 text-sm text-text-muted">Use fictional examples as a starting point; do not upload a statement until you have selected the matching financial account.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Link className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-3 pt-3 text-center text-sm font-bold" href="/api/import-templates/bank">Download bank CSV</Link>
      <Link className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-3 pt-3 text-center text-sm font-bold" href="/api/import-templates/credit-card">Download card CSV</Link>
      <Link className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-3 pt-3 text-center text-sm font-bold" href="/api/import-templates/payroll-summary">Download payroll summary</Link>
    </div>
    <div className="mt-5 grid gap-4 text-sm leading-6 text-text-muted sm:grid-cols-2">
      <p><strong className="text-text-primary">Bank and card required:</strong> <code>date</code>, <code>description</code>, and <code>amount</code>. You may use <code>debit</code> and <code>credit</code> instead of <code>amount</code>.</p>
      <p><strong className="text-text-primary">Optional:</strong> posted date, merchant/payee, memo, and external transaction ID. An external ID makes duplicate detection more reliable.</p>
      <p><strong className="text-text-primary">If a preview is unavailable:</strong> make sure the file is a non-empty CSV, dates use YYYY-MM-DD, and amounts contain numbers only. Choose the account that actually issued the statement.</p>
      <p><strong className="text-text-primary">Duplicates are safe:</strong> exact duplicates are not imported. Possible duplicates stay in review so you decide whether to post or exclude them.</p>
    </div>
  </section>;
}
