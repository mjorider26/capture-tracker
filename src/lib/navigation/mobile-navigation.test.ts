import { describe, expect, it } from "vitest";

import { mobilePrimaryDestinationSlugs, splitMobileNavigation } from "./mobile-navigation";

const items = ["today", "money", "taxes", "documents", "review", "reports", "ask-ai", "activity", "settings"].map((slug) => ({ slug }));

describe("mobile shell navigation", () => {
  it("keeps the five primary tabs in their intended order", () => {
    expect([...mobilePrimaryDestinationSlugs, "more"]).toEqual(["today", "money", "review", "reports", "more"]);
  });

  it("keeps every secondary module, including Settings, reachable through More", () => {
    expect(splitMobileNavigation(items).secondary.map((item) => item.slug)).toEqual(["taxes", "documents", "ask-ai", "activity", "settings"]);
  });
});
