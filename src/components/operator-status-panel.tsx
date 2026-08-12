import Link from "next/link";

type Props = {
  build: string;
  database: "Connected" | "Unavailable";
  migrations: "Current" | "Mismatch" | "Unavailable";
  email: "Configured" | "Not configured";
  plaid: { configured: boolean; connections: number; syncFailures: number; webhookFailures: number };
  invitations: { pending: number; accepted: number; expired: number };
};

export function OperatorStatusPanel({ build, database, migrations, email, plaid, invitations }: Props) {
  const checks = [
    ["Application", "Healthy", "This authenticated operator status page rendered."],
    ["Database", database, database === "Connected" ? "A sanitized operational query succeeded." : "A safe database check did not complete."],
    ["Current release", build, "Build identifier only; no deployment secrets are shown."],
    ["Migrations", migrations, "Schema migration state is checked without exposing database contents."],
    ["Last verified backup", "Verify from production operations", "Backup timestamps are intentionally not copied into the application."],
    ["Document scanner", "Unavailable", "No safe scanner-provider status API is configured for this release."],
    ["Scan queue / DLQ", "Unavailable", "No safe queue-provider status API is configured for this release."],
    ["Transactional email", email, email === "Configured" ? "Delivery remains invitation-specific." : "Invitations can still be delivered through the manual secure link path."],
    ["Plaid integration", plaid.configured ? "Configured" : "Not configured", "Credential names and connection health only; no institution login information or financial activity is exposed."],
    ["Plaid webhooks", plaid.webhookFailures === 0 ? "Healthy" : "Attention", `${plaid.webhookFailures} sanitized failed webhook processing event${plaid.webhookFailures === 1 ? "" : "s"}.`],
  ];
  return <main className="mx-auto min-h-screen max-w-5xl bg-page px-4 py-8 text-text-primary sm:px-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Operator only</p><h1 className="mt-1 text-3xl font-bold text-brand-navy">Operational status</h1><p className="mt-2 max-w-2xl text-sm text-text-muted">Sanitized release state only. Customer financial data, documents, balances, and secrets are never displayed here.</p></div><Link href="/operator/onboarding" className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-4 pt-3 text-sm font-bold">Invitation console</Link></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-2">{checks.map(([label, value, detail]) => <article key={label} className="ui-card p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{label}</p><p className="mt-2 font-bold text-brand-navy">{value}</p><p className="mt-1 text-sm leading-5 text-text-muted">{detail}</p></article>)}</section>
    <section className="ui-card mt-5 p-5"><h2 className="font-bold">Invitations</h2><p className="mt-1 text-sm text-text-muted">Counts only; no invitation recipients or client details are shown.</p><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Count label="Pending" value={invitations.pending}/><Count label="Accepted" value={invitations.accepted}/><Count label="Expired" value={invitations.expired}/></div></section>
    <section className="ui-card mt-5 p-5"><h2 className="font-bold">Plaid operations</h2><p className="mt-1 text-sm text-text-muted">Sanitized counts only; institution names, account metadata, transactions, balances, and credentials are excluded.</p><div className="mt-4 grid grid-cols-2 gap-3 text-center"><Count label="Connections" value={plaid.connections}/><Count label="Sync failures" value={plaid.syncFailures}/></div></section>
  </main>;
}

function Count({ label, value }: { label: string; value: number }) { return <div className="rounded border border-border-subtle bg-surface-secondary p-3"><p className="text-2xl font-bold text-brand-navy">{value}</p><p className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{label}</p></div>; }
