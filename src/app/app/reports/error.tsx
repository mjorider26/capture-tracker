"use client";

export default function ReportsError({ reset }: { reset: () => void }) { return <section className="ui-card p-6"><h1 className="text-xl font-bold">Report unavailable</h1><p className="mt-2 text-sm text-text-muted">The report could not be calculated safely. Your selected period has not been changed.</p><button className="ui-button ui-button-secondary mt-4" onClick={reset}>Retry report</button></section>; }
