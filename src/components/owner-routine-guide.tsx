import Link from "next/link";

import { ButtonLink, PageHeader } from "./ui";

const routine = [
  { when: "As things happen", summary: "Capture new business activity while the details are fresh.", actions: ["Add receipts", "Send invoices", "Enter bills", "Record mileage"] },
  { when: "Once a week", summary: "Open Run My Books and clear only the owner decisions waiting for you.", actions: ["Review transactions", "Resolve receipt exceptions", "Handle payment and Owner Money questions"] },
  { when: "Once a month", summary: "Confirm each statement agrees with Capture Tracker, resolve blockers, then close the month.", actions: ["Reconcile accounts", "Review month-end blockers", "Close the month"] },
  { when: "During the year", summary: "Keep occasional S-Corp workpapers current without letting tax work dominate every day.", actions: ["Review payroll exceptions", "Check Owner Money", "Review applicable tax and basis workpapers"] },
  { when: "At year-end", summary: "Run the Year-End Flight Check and prepare clean records for professional review.", actions: ["Clear bookkeeping issues", "Resolve CPA review items", "Invite CPA or download the CPA package"] },
] as const;

export function OwnerRoutineGuide({ basePath }: { basePath: "/app" | "/demo" }) {
  const monthEndHref = basePath === "/app" ? "/app/taxes/close" : "/demo/money/reconciliations";
  return <section className="space-y-6">
    <PageHeader eyebrow="Quick start" title="How to run your S-Corp books with Capture Tracker" description="You do not need to memorize the product. Capture Tracker surfaces the right routine at the right time." action={<ButtonLink href={`${basePath}/review`}>Run My Books</ButtonLink>} />
    <section className="ui-panel p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">The whole system in 60 seconds</p><h2 className="mt-2 text-2xl font-bold">Capture activity. Clear decisions weekly. Reconcile monthly. Prepare for your CPA at year-end.</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">+ New captures something that happened. Run My Books is the normal weekly routine. Month-end confirms the books match the bank. Year-End Flight Check organizes the CPA handoff.</p></section>
    <section className="ui-card p-5 sm:p-6"><h2 className="text-lg font-bold text-brand-navy">Keep bank activity current</h2><p className="mt-2 text-sm leading-6 text-text-muted">Choose <strong className="text-text-primary">Connect automatically</strong> with read-only Plaid Transactions, or <strong className="text-text-primary">Import it myself</strong> with a transaction CSV. Different business accounts can use different methods. Either way, activity enters the same review process before it becomes accounting.</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><FileMeaning title="Transaction CSV">Adds activity for review.</FileMeaning><FileMeaning title="Statement PDF/image">Reconciliation evidence only.</FileMeaning><FileMeaning title="Receipt PDF/image">Purchase evidence only.</FileMeaning></div><p className="mt-3 text-xs leading-5 text-text-muted">Statements and receipts never create bank transactions. Private documents remain unavailable until security validation succeeds.</p><div className="mt-4 flex flex-wrap gap-4 text-sm font-bold"><Link className="ui-link" href={`${basePath}/money/bank`}>Bank activity settings →</Link><Link className="ui-link" href={`${basePath}/money/import`}>Import transactions →</Link></div></section>
    <ol className="grid gap-4 lg:grid-cols-5" aria-label="Owner financial routine">{routine.map((item, index) => <li className="ui-card p-5" key={item.when}><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">{index + 1} · {item.when}</p><p className="mt-2 text-sm leading-6 text-text-muted">{item.summary}</p><ul className="mt-4 space-y-2 text-sm">{item.actions.map((action) => <li className="flex gap-2" key={action}><span aria-hidden="true" className="text-brand-teal">✓</span><span>{action}</span></li>)}</ul></li>)}</ol>
    <nav aria-label="Routine next steps" className="ui-card flex flex-wrap gap-4 p-5 text-sm"><Link className="ui-link font-bold" href={monthEndHref}>Month-end →</Link><Link className="ui-link font-bold" href={`${basePath}/taxes/year-end`}>Year-End Flight Check →</Link><Link className="ui-link font-bold" href={`${basePath}/taxes/owner-money`}>What is Owner Money? →</Link><Link className="ui-link font-bold" href={`${basePath}/reports/profit-and-loss`}>Where do I see profit? →</Link></nav>
    <p className="text-sm text-text-muted">Need deeper detail? The Product Manual remains the technical reference; this page is the everyday operating instruction.</p>
  </section>;
}

function FileMeaning({ title, children }: { title: string; children: React.ReactNode }) { return <p className="rounded border border-border-subtle p-3"><strong>{title}</strong><span className="mt-1 block text-text-muted">{children}</span></p>; }
