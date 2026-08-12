import type { NavigationIconName } from "@/lib/navigation/application-navigation";

export function NavigationIcon({
  name,
  className,
}: {
  name: NavigationIconName;
  className?: string;
}) {
  const paths = iconPaths[name];
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
}

const iconPaths: Record<NavigationIconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 8h13" /><path d="M15 12h4" /><circle cx="15" cy="12" r=".6" fill="currentColor" /></>,
  receipt: <><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  reports: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V8M16 16V5" /></>,
  taxes: <><path d="M4 5h16" /><path d="M7 5 5 20h14L17 5" /><path d="M9 10h6M9 14h4" /></>,
  review: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 2.4 2.4L16.5 8" /></>,
  reconciliation: <><path d="M7 7h10l-2.5-2.5" /><path d="M17 17H7l2.5 2.5" /><path d="M17 7v4M7 17v-4" /></>,
  activity: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7.2 7.2 0 0 0-.1-1.2l2-1.5-2-3.4-2.35 1a7.8 7.8 0 0 0-2.05-1.2L14.2 3h-4.4l-.3 2.7A7.8 7.8 0 0 0 7.45 6.9l-2.35-1-2 3.4 2 1.5A7.2 7.2 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.35-1a7.8 7.8 0 0 0 2.05 1.2l.3 2.7h4.4l.3-2.7a7.8 7.8 0 0 0 2.05-1.2l2.35 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-.9.6-1.5 1-1.5 2" /><path d="M12 17h.01" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
};
