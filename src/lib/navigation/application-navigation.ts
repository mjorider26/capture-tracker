export type NavigationIconName =
  | "home"
  | "wallet"
  | "receipt"
  | "reports"
  | "taxes"
  | "review"
  | "reconciliation"
  | "activity"
  | "settings"
  | "help"
  | "more";

export const destinations = [
  { slug: "today", label: "Today", icon: "home" },
  { slug: "money", label: "Money", icon: "wallet" },
  { slug: "documents", label: "Documents", icon: "receipt" },
  { slug: "reports", label: "Reports", icon: "reports" },
  { slug: "review", label: "Run My Books", icon: "review" },
  { slug: "taxes", label: "Owner & S-Corp", icon: "taxes" },
  { slug: "activity", label: "Accounting Detail", icon: "activity" },
  { slug: "settings", label: "Settings", icon: "settings" },
] as const satisfies readonly {
  slug: string;
  label: string;
  icon: NavigationIconName;
}[];

export type Destination = (typeof destinations)[number]["slug"];
export type NavigationDestination = Destination | "reconciliation" | "help";
export type NavigationItem = {
  slug: NavigationDestination;
  label: string;
  icon: NavigationIconName;
  path?: string;
};

export const navigationItems: readonly NavigationItem[] = [
  ...destinations.slice(0, 4),
  destinations[4],
  {
    slug: "reconciliation",
    label: "Reconciliation",
    icon: "reconciliation",
    path: "/money/reconciliations",
  },
  destinations[5],
  destinations[6],
  { slug: "help", label: "How to Run My Books", icon: "help", path: "/help" },
  destinations[7],
];

export const mobilePrimaryDestinationSlugs = [
  "today",
  "money",
  "documents",
  "reports",
] as const;

export function isDestination(value: string): value is Destination {
  return destinations.some((destination) => destination.slug === value);
}

export function splitNavigation<T extends { slug: string }>(items: readonly T[]) {
  return {
    primary: mobilePrimaryDestinationSlugs
      .map((slug) => items.find((item) => item.slug === slug))
      .filter((item): item is T => Boolean(item)),
    secondary: items.filter(
      (item) =>
        !mobilePrimaryDestinationSlugs.includes(
          item.slug as (typeof mobilePrimaryDestinationSlugs)[number],
        ),
    ),
  };
}

export function isSecondaryNavigationDestination(
  destination: NavigationDestination | null,
) {
  return Boolean(
    destination &&
      !mobilePrimaryDestinationSlugs.includes(
        destination as (typeof mobilePrimaryDestinationSlugs)[number],
      ),
  );
}

export function navigationHref(basePath: string, item: NavigationItem) {
  return `${basePath}${item.path ?? `/${item.slug}`}`;
}
