import Link from "next/link";

import { BrandIcon } from "./brand";

export const destinations = [
  { slug: "today", label: "Today", mark: "\u25c9" },
  { slug: "money", label: "Money", mark: "\u25c6" },
  { slug: "taxes", label: "Taxes", mark: "\u25b3" },
  { slug: "documents", label: "Documents", mark: "\u25a1" },
  { slug: "review", label: "Review", mark: "\u2713" },
  { slug: "reports", label: "Reports", mark: "\u2261" },
  { slug: "ask-ai", label: "Ask AI", mark: "\u2726" },
] as const;

export type Destination = (typeof destinations)[number]["slug"];

export function isDestination(value: string): value is Destination {
  return destinations.some((destination) => destination.slug === value);
}

export function AppShell({
  mode,
  destination,
  businessName,
  children,
}: {
  mode: "app" | "demo";
  destination: Destination | null;
  businessName: string;
  children: React.ReactNode;
}) {
  const basePath = mode === "demo" ? "/demo" : "/app";
  return (
    <div className="min-h-screen bg-page text-text-primary">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-border-subtle bg-surface px-5 py-6 lg:flex">
        <Brand />
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
          Business
        </p>
        <p className="mt-2 text-sm font-bold">{businessName}</p>
        <Navigation basePath={basePath} destination={destination} />
        {mode === "demo" && (
          <p className="mt-auto rounded-[var(--radius-md)] bg-[var(--brand-teal-soft)] px-3 py-3 text-xs leading-5 text-[var(--brand-teal-strong)]">
            Local fictional demo. Reviews affect only the local demo baseline.
          </p>
        )}
      </aside>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:ml-72 lg:px-10 lg:pb-12 lg:pt-10">
        {children}
      </main>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between">
          {destinations.map((item) => (
            <NavLink
              key={item.slug}
              basePath={basePath}
              item={item}
              active={destination === item.slug}
              compact
            />
          ))}
        </div>
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <BrandIcon decorative className="h-11 w-10" />
      <span className="text-base font-bold tracking-[-0.03em] text-brand-navy">
        Capture<span className="text-brand-teal">Tracker</span>
      </span>
    </div>
  );
}
function Navigation({
  basePath,
  destination,
}: {
  basePath: string;
  destination: Destination | null;
}) {
  return (
    <nav aria-label="Primary navigation" className="mt-6 space-y-1">
      {destinations.map((item) => (
        <NavLink
          key={item.slug}
          basePath={basePath}
          item={item}
          active={destination === item.slug}
        />
      ))}
    </nav>
  );
}
function NavLink({
  basePath,
  item,
  active,
  compact = false,
}: {
  basePath: string;
  item: (typeof destinations)[number];
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={`${basePath}/${item.slug}`}
      aria-current={active ? "page" : undefined}
      className={
        compact
          ? `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] px-1 text-[10px] font-bold ${active ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "text-text-muted"}`
          : `flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-bold transition-colors ${active ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "text-text-muted hover:bg-surface-secondary"}`
      }
    >
      <span
        aria-hidden="true"
        className={compact ? "text-base leading-none" : "text-lg leading-none"}
      >
        {item.mark}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
