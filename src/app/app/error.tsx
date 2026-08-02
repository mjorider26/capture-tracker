"use client";

import { useEffect } from "react";

export default function ApplicationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, []);
  return <main className="mx-auto max-w-2xl p-6 sm:p-10"><section className="ui-card p-6"><p className="text-sm font-bold text-brand-teal">Workspace unavailable</p><h1 className="mt-1 text-2xl font-bold">We couldn’t load this page.</h1><p className="mt-2 text-sm text-text-muted">Your records were not changed. Please try again.</p><button type="button" onClick={reset} className="mt-5 min-h-11 rounded bg-brand-navy px-4 font-bold text-white">Try again</button></section></main>;
}
