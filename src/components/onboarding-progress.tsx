const stepCopy = [
  ["Business", "Confirm the business that Capture Tracker supports."],
  ["Accounts", "Where does your business money live?"],
  ["Starting Books", "Establish where your books begin in Capture Tracker."],
  ["Owner Money", "Make sure money between you and your S-Corp starts correctly."],
  ["Payroll", "Reflect your payroll provider’s activity correctly in the books."],
  ["Fixed Assets", "Identify assets that need CPA-reviewed treatment."],
  ["Reconcile", "Make sure Capture Tracker agrees with your financial statements."],
  ["Finish", "Confirm the books are ready for their normal weekly routine."],
] as const;
type Progress = { openingBalancesPosted: boolean; ownerMoneyInitialized: boolean; payrollYtdEstablished: boolean; fixedAssetsReviewed: boolean; initialReconciliationComplete: boolean };
export function OnboardingProgress({ state }: { state: Progress }) { const complete = [true, state.openingBalancesPosted, state.openingBalancesPosted, state.ownerMoneyInitialized, state.payrollYtdEstablished, state.fixedAssetsReviewed, state.initialReconciliationComplete, state.initialReconciliationComplete]; const next = complete.findIndex((value) => !value); return <section aria-label="Setup progress" className="ui-card mb-6 p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Your setup path</p><ol className="mt-4 grid gap-2 sm:grid-cols-4">{stepCopy.map(([label, detail], index) => <li key={label} className={`rounded border px-3 py-2 text-sm ${complete[index] ? "border-brand-teal/40 bg-brand-teal/10" : index === next ? "border-status-warning bg-status-warning/10" : "border-border-subtle bg-surface-secondary"}`}><p className="font-semibold"><span className="mr-2 text-xs text-text-muted">{complete[index] ? "✓" : index + 1}</span>{label}</p>{index === next && <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>}</li>)}</ol></section>; }
