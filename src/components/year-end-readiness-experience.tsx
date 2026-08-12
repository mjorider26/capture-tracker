import Link from "next/link";

import type { CpaReviewItem, YearEndCheck } from "@/lib/services/year-end";

import { ButtonLink, Card, InlineAlert, PageHeader, StatusBadge } from "./ui";

type Stage = { label: string; keys: string[]; href: string; explanation: string };

const stages: Stage[] = [
  { label: "Books", keys: ["month-closes", "imports", "documents", "reconciliations"], href: "/app/review", explanation: "Completed months, reviewed activity, documents, and reconciliations." },
  { label: "Owner Money", keys: ["owner-money"], href: "/app/taxes/owner-money", explanation: "Owner transfers and reimbursements are resolved." },
  { label: "Payroll", keys: ["payroll"], href: "/app/taxes/payroll", explanation: "Payroll records agree with bank evidence." },
  { label: "Basis", keys: ["basis", "basis-adjustments"], href: "/app/taxes/owner-money/s-corp", explanation: "Stock and debt basis remain separate, sourced workpapers." },
  { label: "Benefits", keys: ["shareholder-benefits"], href: "/app/taxes/owner-money/s-corp", explanation: "Shareholder-benefit workpapers are ready for professional review." },
  { label: "Fixed assets", keys: ["assets", "fixed-asset-tax-treatment"], href: "/app/taxes/fixed-assets", explanation: "Bookkeeping evidence is complete; tax treatment remains with the CPA." },
  { label: "CPA review items", keys: ["debt-basis", "accountable-plan-policy", "distributions", "shareholder-loans"], href: "/app/taxes/owner-money/s-corp", explanation: "Items needing professional judgment are clearly separated." },
  { label: "CPA package", keys: [], href: "/app/reports", explanation: "Prepare the tenant-scoped schedules and supporting package." },
];

function stageHref(stage: Stage, basePath: "/app" | "/demo") {
  if (basePath === "/demo" && stage.href === "/app/taxes/fixed-assets") {
    return "/demo/taxes";
  }
  return `${basePath}${stage.href.replace(/^\/app/, "")}`;
}

export function YearEndReadinessExperience({ year, status, checks, cpaReviewItems = [], basePath = "/app" }: { year: number; status: "ISSUES_REMAIN" | "READY_FOR_CPA"; checks: YearEndCheck[]; cpaReviewItems?: CpaReviewItem[]; basePath?: "/app" | "/demo" }) {
  const ready = status === "READY_FOR_CPA";
  const reviewMap = new Map([...checks, ...cpaReviewItems].map((item) => [item.key, item]));
  return <>
    <PageHeader eyebrow="At year-end" title={`${year} Year-End Flight Check`} description="Follow one sequence from clean books to CPA handoff. Capture Tracker prepares records; it never claims the tax return is ready." />
    <InlineAlert title={ready ? "Ready for CPA" : "Year-end still needs you"} tone={ready ? "success" : "warning"}>{ready ? "Deterministic bookkeeping checks pass. Professional-review workpapers remain clearly labeled." : "Work through each NEEDS YOU section. CPA REVIEW items may require professional judgment but are not hidden."}</InlineAlert>
    <ol className="mt-6 space-y-3" aria-label="Year-End Flight Check progress">{stages.map((stage, index) => {
      const items = stage.keys.flatMap((key) => reviewMap.get(key) ? [reviewMap.get(key)!] : []);
      const ownerCount = items.filter((item) => checks.some((check) => check.key === item.key)).reduce((sum, item) => sum + item.count, 0);
      const cpaCount = items.filter((item) => cpaReviewItems.some((check) => check.key === item.key)).reduce((sum, item) => sum + item.count, 0);
      const packageReady = stage.label === "CPA package" && ready;
      const tone = ownerCount ? "warning" : cpaCount ? "info" : "success";
      const state = ownerCount ? "NEEDS YOU" : cpaCount ? "CPA REVIEW" : packageReady || stage.label !== "CPA package" ? "DONE" : "WAITING";
      const href = stageHref(stage, basePath);
      return <li className="ui-card p-5" key={stage.label}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-teal">{index + 1} of {stages.length}</p><h2 className="mt-1 text-lg font-bold text-brand-navy">{stage.label}</h2><p className="mt-1 text-sm text-text-muted">{stage.explanation}</p></div><StatusBadge tone={tone}>{state}</StatusBadge></div>{items.length ? <ul className="mt-3 space-y-2 text-sm text-text-muted">{items.map((item) => <li key={item.key}>{item.count ? `${item.count} · ` : ""}{item.detail}</li>)}</ul> : null}{ownerCount || cpaCount || stage.label === "CPA package" ? <Link className="ui-link mt-3 inline-block text-sm font-bold" href={href}>{stage.label === "CPA package" ? "Open CPA package" : "Open this section"} →</Link> : null}</li>;
    })}</ol>
    {ready ? <Card className="mt-6 border border-brand-teal/30 bg-brand-teal-soft p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Final state</p><h2 className="mt-2 text-2xl font-bold text-brand-navy">READY FOR CPA</h2><p className="mt-2 text-sm text-text-muted">Choose the supported handoff that fits your business. No tax filing occurs here.</p><div className="mt-4 flex flex-wrap gap-3">{basePath === "/app" ? <><ButtonLink href="/app/settings/cpa">Invite CPA</ButtonLink><ButtonLink href="/app/settings/cpa" tone="secondary">Open CPA Access</ButtonLink><ButtonLink href="/api/cpa-package" tone="secondary">Download CPA Package</ButtonLink></> : <ButtonLink href="/demo/reports">Open fictional CPA package preview</ButtonLink>}</div></Card> : null}
  </>;
}
