"use client";

import { useEffect } from "react";

import { workspaceClientFailureMetadata } from "@/lib/observability/workspace-failure";

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const body = workspaceClientFailureMetadata(error, window.location.pathname);
    void fetch("/api/internal/workspace-failure", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [error]);
  return (
    <main className="mx-auto max-w-2xl p-6 sm:p-10">
      <section
        role="alert"
        className="ui-panel border-l-4 border-[var(--danger)] p-6"
      >
        <p className="text-sm font-bold text-[var(--danger)]">
          Workspace unavailable
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em]">
          We couldn’t load this page.
        </h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          Your records were not changed. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="ui-button ui-button-primary mt-5 min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white transition-colors hover:bg-[var(--brand-navy-strong)] focus-visible:outline-none"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
