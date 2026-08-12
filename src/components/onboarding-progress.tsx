const stepCopy = [
  ["Business", "Confirm the S-Corp information Capture Tracker will support."],
  ["Accounts", "Add your business bank or credit card."],
  ["Starting books", "Tell Capture Tracker where your books start."],
  ["Owner & payroll", "Confirm the owner and payroll facts that apply."],
  ["First activity", "Bring in and review the first business activity."],
  ["Initial reconciliation", "Confirm Capture Tracker and the starting statement agree exactly."],
  ["Ready", "Begin the normal Run My Books routine."],
] as const;

type Progress = { openingBalancesPosted: boolean; ownerMoneyInitialized: boolean; payrollYtdEstablished: boolean; fixedAssetsReviewed: boolean; initialReconciliationComplete: boolean };

export function OnboardingProgress({ state }: { state: Progress }) {
  const ownerAndPayroll = state.ownerMoneyInitialized && state.payrollYtdEstablished && state.fixedAssetsReviewed;
  const complete = [true, state.openingBalancesPosted, state.openingBalancesPosted, ownerAndPayroll, state.openingBalancesPosted, state.initialReconciliationComplete, state.initialReconciliationComplete];
  const next = complete.findIndex((value) => !value);
  return <>
    <section className="ui-panel mb-6 p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Welcome to Capture Tracker</p><h1 className="mt-2 text-2xl font-bold">Keep the company’s books current without becoming an accountant.</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">Capture Tracker collects financial evidence, asks for decisions when they are needed, helps reconcile the books, and prepares professional records. Setup establishes where those records begin.</p></section>
    <section aria-label="First-time setup roadmap" className="ui-card mb-6 p-5"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">First-time setup</p><h2 className="mt-1 text-xl font-bold">A clear path to ready</h2></div><span className="text-xs font-bold text-text-muted">{complete.filter(Boolean).length} of {complete.length} complete</span></div><ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{stepCopy.map(([label, detail], index) => <li key={label} aria-current={index === next ? "step" : undefined} className={`rounded border px-3 py-3 text-sm ${complete[index] ? "border-brand-teal/40 bg-brand-teal/10" : index === next ? "border-status-warning bg-status-warning/10" : "border-border-subtle bg-surface-secondary"}`}><p className="font-semibold"><span className="mr-2 text-xs text-text-muted">{complete[index] ? "✓" : index + 1}</span>{label}</p>{index === next ? <p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p> : null}</li>)}</ol></section>
  </>;
}
