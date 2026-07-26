import Link from "next/link";

import { BrandIcon } from "./brand";
import { MobileNavigation } from "./mobile-navigation";

export const destinations = [
  { slug: "today", label: "Today", mark: "◉" },
  { slug: "money", label: "Money", mark: "◇" },
  { slug: "taxes", label: "Taxes", mark: "△" },
  { slug: "documents", label: "Documents", mark: "□" },
  { slug: "review", label: "Review", mark: "✓" },
  { slug: "reports", label: "Reports", mark: "≡" },
  { slug: "ask-ai", label: "Ask AI", mark: "✦" },
  { slug: "activity", label: "Activity", mark: "◴" },
  { slug: "settings", label: "Settings", mark: "⚙" },
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
  const current = destinations.find((item) => item.slug === destination);
  return (
    <div className="min-h-screen overflow-x-clip bg-page text-text-primary">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/10 bg-brand-navy px-4 py-5 text-white lg:flex">
        <Brand />
        <div className="mt-8 rounded-[var(--radius-md)] border border-white/10 bg-white/[0.06] px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Business</p>
          <p className="mt-1 truncate text-sm font-bold text-white">{businessName}</p>
        </div>
        <Navigation basePath={basePath} destination={destination} />
        {mode === "demo" && (
          <p className="mt-auto rounded-[var(--radius-md)] border border-brand-teal/30 bg-brand-teal/15 px-3 py-3 text-xs leading-5 text-teal-50">
            Local fictional demo. Changes remain within the local demo boundary.
          </p>
        )}
      </aside>
      <main className="min-w-0 pb-24 lg:ml-60 lg:pb-10">
        <div className="sticky top-0 z-10 border-b border-border-subtle bg-page/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="hidden text-xs font-semibold text-text-muted sm:block">Financial workspace</p>
              <p className="truncate text-sm font-bold tracking-[-0.01em] text-text-primary sm:text-base">{current?.label ?? "Capture Tracker"}</p>
            </div>
            <div className="flex items-center gap-2">
              {mode === "demo" && <span className="ui-status-badge bg-brand-teal-soft text-brand-teal">Demo · local only</span>}
              <span className="hidden max-w-52 truncate text-xs font-semibold text-text-muted md:inline">{businessName}</span>
              <span className="hidden h-9 w-9 place-items-center rounded-full bg-surface-secondary text-brand-navy md:grid" aria-hidden="true">◌</span>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[88rem] px-4 pt-7 sm:px-6 lg:px-10 lg:pt-9">
          {children}
        </div>
      </main>
      <MobileNavigation basePath={basePath} destination={destination} items={destinations} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-white p-1.5 shadow-sm">
        <BrandIcon decorative className="h-7 w-6" />
      </span>
      <span className="text-[15px] font-bold tracking-[-0.03em] text-white">
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
    <nav aria-label="Primary navigation" className="mt-7 space-y-1">
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
}: {
  basePath: string;
  item: (typeof destinations)[number];
  active: boolean;
}) {
  return (
    <Link
      href={`${basePath}/${item.slug}`}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-bold transition-colors ${active ? "bg-white text-brand-navy shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
    >
      <span
        aria-hidden="true"
        className="text-lg leading-none"
      >
        {item.mark}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}
