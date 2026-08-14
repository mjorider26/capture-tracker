import Link from "next/link";

import type { OnboardingPhase } from "@/generated/prisma/client";

import { BrandIcon } from "./brand";
import { SignOutButton } from "./sign-out-button";

const stages = [
  { label: "Welcome", phases: ["WELCOME_PENDING"] },
  { label: "Business", phases: ["BUSINESS_CONFIRMATION"] },
  { label: "Bank activity", phases: ["BANK_ACTIVITY_CHOICE", "PLAID_CONNECTION", "MANUAL_ACTIVITY"] },
  { label: "Starting books", phases: ["STARTING_BOOKS_IN_PROGRESS", "INITIAL_ACTIVITY_REVIEW"] },
  { label: "Reconcile", phases: ["RECONCILIATION_REQUIRED"] },
  { label: "Ready", phases: ["READINESS_CHECK", "TOUR_PENDING", "COMPLETE"] },
] as const;

export function OnboardingShell({ businessName, phase, children }: { businessName: string; phase: OnboardingPhase; children: React.ReactNode }) {
  const active = Math.max(0, stages.findIndex((stage) => (stage.phases as readonly string[]).includes(phase)));
  return <div className="onboarding-shell min-h-screen bg-page text-text-primary">
    <header className="border-b border-border-subtle bg-brand-navy text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/app/onboarding" className="flex min-w-0 items-center gap-3" aria-label="Capture Tracker setup home"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><BrandIcon decorative className="h-8 w-7" /></span><span className="min-w-0"><span className="block font-bold">Capture<span className="text-brand-teal">Tracker</span></span><span className="block truncate text-xs text-white/65">Setting up {businessName}</span></span></Link>
        <div className="shrink-0"><SignOutButton /></div>
      </div>
    </header>
    <div className="border-b border-border-subtle bg-white">
      <nav aria-label="Setup progress" className="mx-auto max-w-5xl overflow-x-auto px-4 py-4 sm:px-6"><ol className="flex min-w-[38rem] items-start gap-2">{stages.map((stage, index) => <li key={stage.label} className="flex flex-1 items-start gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index < active ? "bg-brand-teal text-white" : index === active ? "bg-brand-navy text-white ring-4 ring-brand-teal-soft" : "bg-surface-secondary text-text-muted"}`}>{index < active ? "✓" : index + 1}</span><span className={`pt-1 text-xs font-bold ${index === active ? "text-brand-navy" : "text-text-muted"}`}>{stage.label}</span>{index < stages.length - 1 && <span aria-hidden="true" className="mt-3 h-px flex-1 bg-border-subtle" />}</li>)}</ol></nav>
    </div>
    <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">{children}<footer className="mt-10 border-t border-border-subtle pt-5 text-xs leading-5 text-text-muted"><p>Your progress saves after every step. You can sign out and return through the same invitation account.</p><p className="mt-1 font-bold tracking-[0.12em] text-brand-teal">SPENDING TRACKED. BUSINESS GROWN.</p></footer></main>
  </div>;
}

export function SetupCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="ui-card mx-auto max-w-3xl overflow-hidden"><header className="border-b border-border-subtle bg-surface-secondary p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-brand-navy sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">{description}</p></header><div className="p-5 sm:p-7">{children}</div></section>;
}
