"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const messages: Record<string, string> = {
  "/app/today": "Today shows the accounting items that actually need your attention.",
  "/app/money/import": "Bank activity is evidence first. Review the accounting treatment before posting.",
  "/app/documents": "Uploaded documents are security-scanned before they become available.",
  "/app/taxes/owner-money": "Keep salary, distributions, reimbursements, contributions, and shareholder loans separate.",
  "/app/review": "Use Weekly Review once a week to keep your books current.",
  "/app/money/reconciliations": "Your statement and Capture Tracker must reach an exact $0.00 difference before finalizing.",
  "/app/taxes/close": "Close a period only after the accounting blockers are resolved.",
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
