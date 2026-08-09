import Link from "next/link";

import {
  destinations,
  isDestination,
  navigationHref,
  navigationItems,
  splitNavigation,
  type Destination,
  type NavigationDestination,
  type NavigationItem,
} from "@/lib/navigation/application-navigation";

import { BrandIcon } from "./brand";
import { MobileNavigation } from "./mobile-navigation";
import { NavigationIcon } from "./navigation-icons";
import { SignOutButton } from "./sign-out-button";
import { AppPullToRefresh } from "./app-pull-to-refresh";
import { FirstUseGuidance } from "./first-use-guidance";

export { destinations, isDestination, type Destination };

export function AppShell({
  mode,
  destination,
  navigationDestination,
  businessName,
  children,
}: {
  mode: "app" | "demo";
  destination: Destination | null;
  navigationDestination?: NavigationDestination | null;
  businessName: string;
  children: React.ReactNode;
}) {
  const basePath = mode === "demo" ? "/demo" : "/app";
  const current = destinations.find((item) => item.slug === destination);
  const activeNavigation = navigationDestination ?? destination;
  return (
    <AppPullToRefresh><div className="app-shell min-h-screen overflow-x-clip bg-page text-text-primary">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-white/10 bg-brand-navy px-4 py-5 text-white min-[1180px]:flex">
        <Brand />
        <div className="app-business-identity mt-7 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
            Business
          </p>
          <p className="mt-1 truncate text-sm font-bold text-white">
            {businessName}
          </p>
        </div>
        <Navigation basePath={basePath} destination={activeNavigation} />
        {mode === "demo" && (
          <p className="mt-auto rounded-[var(--radius-md)] border border-brand-teal/30 bg-brand-teal/15 px-3 py-3 text-xs leading-5 text-teal-50">
            Local fictional demo. Changes remain within the local demo boundary.
          </p>
        )}
      </aside>
      <main className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] min-[1180px]:ml-60 min-[1180px]:pb-10">
        <div className="sticky top-0 z-10 border-b border-border-subtle bg-page/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6 min-[1180px]:py-3 lg:px-10">
          <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-brand-navy shadow-sm min-[1180px]:hidden">
                <BrandIcon decorative className="h-8 w-7" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-[-0.02em] text-brand-navy min-[1180px]:hidden">
                  Capture<span className="text-brand-teal">Tracker</span>
                </p>
                <p className="hidden text-xs font-semibold text-text-muted min-[1180px]:block">
                  Financial workspace
                </p>
                <p className="truncate text-xs font-bold text-text-muted min-[1180px]:text-base min-[1180px]:text-text-primary">
                  {current?.label ?? "Workspace"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mode === "demo" && (
                <span className="ui-status-badge bg-surface-secondary text-text-muted">
                  Demo / local
                </span>
              )}
              <span className="hidden max-w-52 truncate text-xs font-semibold text-text-muted md:inline">
                {businessName}
              </span>
              {mode === "app" && <SignOutButton />}
              <span
                className="hidden h-9 w-9 place-items-center rounded-full border border-white/10 bg-surface-secondary text-brand-teal md:grid"
                aria-hidden="true"
              >
                <BrandIcon decorative className="h-5 w-4" />
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[88rem] px-4 pt-7 sm:px-6 lg:px-10 lg:pt-9">
          {mode === "app" && <FirstUseGuidance />}
          {children}
        </div>
      </main>
      <MobileNavigation
        basePath={basePath}
        destination={activeNavigation}
        items={navigationItems}
      />
    </div></AppPullToRefresh>
  );
}

function Brand() {
  return (
    <div className="app-shell-brand flex items-center gap-2.5 px-1">
      <span className="grid h-10 w-10 place-items-center bg-white/10 shadow-sm">
        <BrandIcon decorative className="h-9 w-8" />
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
  destination: NavigationDestination | null;
}) {
  const { primary, secondary } = splitNavigation(navigationItems);
  return (
    <nav aria-label="Primary navigation" className="app-shell-navigation mt-7">
      <NavigationGroup items={primary} basePath={basePath} destination={destination} />
      <div className="app-shell-nav-divider" aria-hidden="true" />
      <NavigationGroup items={secondary} basePath={basePath} destination={destination} />
    </nav>
  );
}

function NavigationGroup({
  items,
  basePath,
  destination,
}: {
  items: readonly NavigationItem[];
  basePath: string;
  destination: NavigationDestination | null;
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={navigationHref(basePath, item)}
          aria-current={destination === item.slug ? "page" : undefined}
          className={`app-shell-nav-link ${destination === item.slug ? "is-active" : ""}`}
        >
          <span aria-hidden="true" className="app-shell-nav-mark">
            <NavigationIcon name={item.icon} className="h-[1.05rem] w-[1.05rem]" />
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
