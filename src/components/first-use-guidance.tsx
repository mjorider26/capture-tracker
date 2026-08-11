"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const messages: Record<string, string> = {
  "/app/today": "Today brings forward the bookkeeping decisions that actually need your attention. Books Current Through shows the date your evidence supports.",
  "/app/money": "Manage activity, invoices, bills, reconciliation, and owner-related money from this hub.",
  "/app/money/invoices": "Invoices track what customers owe and let you record incoming payment evidence without processing a payment.",
  "/app/money/bills": "Bills track vendor obligations before payment, so the expense is not counted twice.",
  "/app/money/import": "Bank activity is evidence first. Review the accounting treatment before posting.",
  "/app/documents": "Uploaded documents are security-scanned before they become available.",
  "/app/taxes/owner-money": "Keep salary, distributions, reimbursements, contributions, and shareholder loans separate.",
  "/app/taxes/mileage": "Record each business trip with its purpose and exact miles before creating reimbursement work.",
  "/app/reports": "Start with the business question you want answered; technical accounting report names remain available.",
  "/app/review": "Use Weekly Review once a week to keep your books current.",
  "/app/money/reconciliations": "Your statement and Capture Tracker must reach an exact $0.00 difference before finalizing.",
  "/app/taxes/close": "Close a period only after the accounting blockers are resolved.",
  "/app/taxes/year-end": "Year-End Flight Check surfaces deterministic bookkeeping issues before CPA handoff; it is not tax advice.",
  "/app/settings/cpa": "Invite a CPA for secure read-only review. Owner mutation actions stay unavailable to that role.",
};

export function FirstUseGuidance() {
  const pathname = usePathname();
  const message = messages[pathname];
  const key = `capture-tracker:guidance:${pathname}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDismissed(!message || window.localStorage.getItem(key) === "dismissed"));
    return () => window.cancelAnimationFrame(frame);
  }, [key, message]);
  if (!message || dismissed) return null;
  return <section className="mb-5 flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm text-text-primary" aria-label="First-use guidance"><p>{message}</p><button type="button" className="shrink-0 font-bold text-brand-navy underline" onClick={() => { window.localStorage.setItem(key, "dismissed"); setDismissed(true); }}>Got it</button></section>;
}
