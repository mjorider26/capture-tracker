import Link from "next/link";

export const destinations = [
  { slug: "today", label: "Today", mark: "◉" },
  { slug: "money", label: "Money", mark: "◈" },
  { slug: "taxes", label: "Taxes", mark: "△" },
  { slug: "documents", label: "Documents", mark: "□" },
  { slug: "ask-ai", label: "Ask AI", mark: "✦" },
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
  destination: Destination;
  businessName: string;
  children: React.ReactNode;
}) {
  const basePath = mode === "demo" ? "/demo" : "/app";

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-[#10233f]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#dce5f0] bg-white px-5 py-6 lg:flex">
        <Brand />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#6c7b90]">
          Business
        </p>
        <p className="mt-2 text-sm font-semibold text-[#10233f]">
          {businessName}
        </p>
        <Navigation basePath={basePath} destination={destination} />
        {mode === "demo" && (
          <p className="mt-auto rounded-xl bg-[#e7f9fb] px-3 py-2 text-xs leading-5 text-[#126676]">
            Local fictional demo. Reviews affect only the local demo baseline.
          </p>
        )}
      </aside>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-10 lg:pb-10 lg:pt-8">
        {children}
      </main>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[#dce5f0] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
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
      <span
        aria-hidden="true"
        className="grid h-9 w-9 place-items-center rounded-xl bg-[#155eef] text-sm font-black text-white shadow-sm"
      >
        CT
      </span>
      <span className="text-base font-bold tracking-tight text-[#10233f]">
        Capture Tracker
      </span>
    </div>
  );
}

function Navigation({
  basePath,
  destination,
}: {
  basePath: string;
  destination: Destination;
}) {
  return (
    <nav aria-label="Primary navigation" className="mt-5 space-y-1">
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
          ? `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold ${active ? "bg-[#e8efff] text-[#155eef]" : "text-[#63738a]"}`
          : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12b8c8] ${active ? "bg-[#e8efff] text-[#155eef]" : "text-[#51627a] hover:bg-[#f4f7fb]"}`
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
