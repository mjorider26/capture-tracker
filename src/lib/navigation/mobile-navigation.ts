export const mobilePrimaryDestinationSlugs = [
  "today",
  "money",
  "review",
  "reports",
] as const;

export function splitMobileNavigation<T extends { slug: string }>(items: readonly T[]) {
  return {
    primary: mobilePrimaryDestinationSlugs.map((slug) => items.find((item) => item.slug === slug)).filter((item): item is T => Boolean(item)),
    secondary: items.filter((item) => !mobilePrimaryDestinationSlugs.includes(item.slug as typeof mobilePrimaryDestinationSlugs[number])),
  };
}
