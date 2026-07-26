"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import { BrandIcon } from "./brand";

type NavigationItem = { slug: string; label: string; mark: string };

export function MobileNavigation({
  basePath,
  destination,
  items,
}: {
  basePath: string;
  destination: string | null;
  items: readonly NavigationItem[];
}) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const current = items.find((item) => item.slug === destination);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="min-[1180px]:hidden">
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(11_34_57_/_0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-text-primary">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-teal-soft text-brand-teal">
              {current?.mark ?? "◌"}
            </span>
            <span className="truncate">{current?.label ?? "Workspace"}</span>
          </span>
          <button
            type="button"
            aria-controls={drawerId}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="ui-icon-button min-h-11 min-w-11 px-3 text-sm font-bold"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {open ? "×" : "☰"}
            </span>
            <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 bg-brand-navy/35" onClick={() => setOpen(false)}>
          <section
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="ml-auto flex h-full w-[min(20rem,86vw)] flex-col bg-surface px-5 py-6 shadow-[0_16px_48px_rgb(11_34_57_/_0.24)] motion-safe:animate-[slide-in_180ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold tracking-[-0.02em] text-brand-navy">
                <BrandIcon decorative className="h-9 w-8" />
                Capture Tracker
              </span>
              <button type="button" onClick={() => setOpen(false)} className="ui-icon-button" aria-label="Close navigation">
                ×
              </button>
            </div>
            <nav className="mt-8 space-y-1" aria-label="Primary navigation">
              {items.map((item) => {
                const active = item.slug === destination;
                return (
                  <Link
                    key={item.slug}
                    href={`${basePath}/${item.slug}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-bold transition-colors ${active ? "bg-brand-navy text-white shadow-sm" : "text-text-muted hover:bg-surface-secondary hover:text-text-primary"}`}
                  >
                    <span aria-hidden="true" className="text-lg">{item.mark}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <p className="mt-auto rounded-[var(--radius-md)] bg-surface-secondary p-3 text-xs leading-5 text-text-muted">
              Navigation changes only your view. Financial actions remain available only in their existing protected workflows.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
