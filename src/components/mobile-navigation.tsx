"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { splitMobileNavigation } from "@/lib/navigation/mobile-navigation";

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
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const { primary, secondary } = splitMobileNavigation(items);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    if (open && !wasOpen.current) closeButton.current?.focus();
    if (!open && wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="min-[1180px]:hidden">
      <nav
        aria-label="Primary mobile navigation"
        className="mobile-shell-nav fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgb(11_34_57_/_0.08)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
          {primary.map((item) => (
            <Tab
              key={item.slug}
              item={item}
              basePath={basePath}
              active={destination === item.slug}
            />
          ))}
          <button
            ref={opener}
            type="button"
            aria-controls={drawerId}
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-1 text-[11px] font-bold transition-colors ${open ? "bg-brand-teal-soft text-brand-teal shadow-sm" : "text-text-muted hover:bg-surface-secondary"}`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              •••
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-brand-navy/35"
          onClick={() => setOpen(false)}
        >
          <section
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            className="mobile-nav-drawer ml-auto flex h-full w-[min(22rem,90vw)] flex-col overflow-y-auto bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] shadow-[0_16px_48px_rgb(11_34_57_/_0.24)] motion-safe:animate-[slide-in_180ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-bold tracking-[-0.02em] text-brand-navy">
                <BrandIcon decorative className="h-10 w-9" />
                CaptureTracker
              </span>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setOpen(false)}
                className="ui-icon-button"
                aria-label="Close More navigation"
              >
                ×
              </button>
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-text-subtle">
              More workspace tools
            </p>
            <nav className="mt-3 space-y-1" aria-label="Secondary navigation">
              {secondary.map((item) => (
                <Link
                  key={item.slug}
                  href={`${basePath}/${item.slug}`}
                  aria-current={destination === item.slug ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-bold transition-colors ${destination === item.slug ? "bg-brand-teal-soft text-brand-teal" : "text-text-muted hover:bg-surface-secondary hover:text-text-primary"}`}
                >
                  <span aria-hidden="true" className="text-lg">
                    {item.mark}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="mt-auto rounded-[var(--radius-md)] bg-surface-secondary p-3 text-xs leading-5 text-text-muted">
              Navigation changes only your view. Financial actions remain
              available only in their existing protected workflows.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Tab({
  item,
  basePath,
  active,
}: {
  item: NavigationItem;
  basePath: string;
  active: boolean;
}) {
  return (
    <Link
      href={`${basePath}/${item.slug}`}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-1 text-[11px] font-bold transition-colors ${active ? "bg-brand-teal-soft text-brand-teal shadow-sm" : "text-text-muted hover:bg-surface-secondary"}`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {item.mark}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
