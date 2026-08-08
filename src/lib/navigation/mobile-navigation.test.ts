import { describe, expect, it } from "vitest";

import {
  isSecondaryNavigationDestination,
  mobilePrimaryDestinationSlugs,
  navigationHref,
  navigationItems,
  splitNavigation,
} from "./application-navigation";

describe("mobile shell navigation", () => {
  it("keeps the five primary tabs in their intended order", () => {
    expect([...mobilePrimaryDestinationSlugs, "more"]).toEqual(["today", "money", "documents", "reports", "more"]);
  });

  it("keeps Taxes, Review, Reconciliation, Activity, and Settings reachable through More", () => {
    expect(splitNavigation(navigationItems).secondary.map((item) => item.slug)).toEqual([
      "taxes",
      "review",
      "reconciliation",
      "activity",
      "settings",
    ]);
  });

  it("uses unique semantic icons and keeps reconciliation on its existing Money route", () => {
    const icons = [...navigationItems.map((item) => item.icon), "more"];
    expect(new Set(icons).size).toBe(icons.length);
    expect(navigationItems.slice(0, 4).map((item) => item.icon)).toEqual([
      "home",
      "wallet",
      "receipt",
      "reports",
    ]);
    expect(navigationHref("/app", navigationItems.find((item) => item.slug === "reconciliation")!)).toBe("/app/money/reconciliations");
  });

  it("keeps grouped document and report routes primary while secondary routes activate More", () => {
    expect(isSecondaryNavigationDestination("documents")).toBe(false);
    expect(isSecondaryNavigationDestination("reports")).toBe(false);
    expect(isSecondaryNavigationDestination("taxes")).toBe(true);
    expect(isSecondaryNavigationDestination("reconciliation")).toBe(true);
  });
});
