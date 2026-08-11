import Link from "next/link";
import { Card, InlineAlert, PageHeader, StatusBadge } from "./ui";
import type { CpaReviewItem, YearEndCheck } from "@/lib/services/year-end";

export function YearEndReadinessExperience({ year, status, checks, cpaReviewItems = [] }: { year: number; status: "ISSUES_REMAIN" | "READY_FOR_CPA"; checks: YearEndCheck[]; cpaReviewItems?: CpaReviewItem[] }) {
  const ready = status === "READY_FOR_CPA";
  return <>
    <PageHeader eyebrow="Year-end" title={`${year} year-end readiness`} description="A deterministic bookkeeping review for CPA handoff. It is not tax, payroll, or legal advice." />
    <InlineAlert title={ready ? "Ready for CPA" : "Issues remain"} tone={ready ? "success" : "warning"}>{ready ? "All deterministic bookkeeping checks pass. CPA workpaper items are shown separately." : "Resolve the listed bookkeeping exceptions before treating the year as ready for CPA handoff."}</InlineAlert>
    <Card className="mt-6 p-5"><div className="flex items-center justify-between gap-4"><h2 className="font-bold">Year-end review</h2><StatusBadge tone={ready ? "success" : "warning"}>{ready ? "READY FOR CPA" : "ISSUES REMAIN"}</StatusBadge></div><div className="mt-4 space-y-3">{checks.map((check) => <div className="border-t border-border-subtle pt-3" key={check.key}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{check.label}</span><span>{check.count === 0 ? "Pass" : `${check.count} issue${check.count === 1 ? "" : "s"}`}</span></div><p className="mt-1 text-sm text-text-muted">{check.detail}</p></div>)}</div></Card>
    {cpaReviewItems.length > 0 && <Card className="mt-6 p-5"><div className="flex items-center justify-between gap-4"><h2 className="font-bold">CPA review items</h2><StatusBadge tone="info">CPA REVIEW ITEM</StatusBadge></div><div className="mt-4 space-y-3">{cpaReviewItems.map((item) => <div className="border-t border-border-subtle pt-3" key={item.key}><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{item.label}</span><span>{item.count}</span></div><p className="mt-1 text-sm text-text-muted">{item.detail}</p></div>)}</div></Card>}
    <nav className="mt-6 flex flex-wrap gap-3 border-t border-border-subtle pt-5 text-sm" aria-label="Year-end next steps"><Link className="ui-link font-bold" href="/app/money/reconciliations">Review reconciliations →</Link><Link className="ui-link font-bold" href="/app/taxes/owner-money">Resolve owner reimbursements →</Link><Link className="ui-link font-bold" href="/app/taxes/owner-money/s-corp">Review basis and benefits →</Link><Link className="ui-link font-bold" href="/app/reports">Prepare CPA package →</Link></nav>
  </>;
}
