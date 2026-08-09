import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getBooksCurrentThrough } from "@/lib/services/books-current-through";
import { prisma } from "@/lib/prisma";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

const reviewAreas = [
  ["Financial statements", "Profit and loss, balance sheet, trial balance, general ledger, and reconciliation evidence.", "/app/reports"],
  ["Transactions and evidence", "Read transaction history, imports, and any owner-authorized active and clean documents.", "/app/money"],
  ["Owner Money and S-Corp workpapers", "Review reimbursements, distributions, basis, debt basis, compensation, payroll, benefits, and assets.", "/app/taxes"],
  ["Operational schedules", "Review invoices, receivables, bills, payables, and mileage without changing their records.", "/app/reports/operations"],
  ["Year-end flight check", "Review bookkeeping exceptions and CPA review items; this workspace does not prepare a tax return.", "/app/taxes/year-end"],
] as const;

export default async function CpaReviewPage() {
  let context;
  try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  if (context.membership.role !== "CPA_READ_ONLY") notFound();
  const books = await getBooksCurrentThrough(prisma, context.business.id);
  const current = books.date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(books.date) : "BOOKKEEPING REVIEW REQUIRED";
  return <AppShell mode="app" destination="reports" businessName={context.business.displayName}>
    <section className="max-w-5xl">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand-teal">Professional review</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-brand-navy">CPA Review</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">This business-scoped workspace is read-only. You can review factual records and workpapers, but cannot create, edit, post, link, remove, or change owner settings.</p>
      <section className="ui-card mt-6 p-5"><p className="text-sm font-bold text-brand-navy">Books current through</p><p className="mt-1 text-lg font-bold text-brand-teal">{books.date ? `Books current through ${current}` : current}</p>{books.blockers.length > 0 && <p className="mt-2 text-sm text-text-muted">{books.blockers.length} deterministic bookkeeping item{books.blockers.length === 1 ? " remains" : "s remain"} for owner review.</p>}</section>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{reviewAreas.map(([title, description, href]) => <Link key={href} href={href} className="ui-card block min-h-36 p-5 transition-colors hover:border-brand-teal/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"><h2 className="font-bold text-brand-navy">{title}</h2><p className="mt-2 text-sm leading-6 text-text-muted">{description}</p><span className="mt-4 inline-block text-sm font-bold text-brand-teal">Open review</span></Link>)}</div>
    </section>
  </AppShell>;
}
