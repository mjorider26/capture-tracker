import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { navigationItems } from "@/lib/navigation/application-navigation";

import { MobileNavigation } from "./mobile-navigation";

describe("MobileNavigation", () => {
  it("renders the five concise primary labels in order with a current-page state", () => {
    const html = renderToStaticMarkup(
      <MobileNavigation
        basePath="/app"
        destination="documents"
        items={navigationItems}
      />,
    );

    const labels = ["Today", "Money", "Documents", "Reports", "More"];
    const indexes = labels.map((label) => html.indexOf(`>${label}<`));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
    expect(html).toContain('href="/app/documents"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("grid-cols-5");
    expect(html).toContain("min-h-12");
  });

  it("marks More as current for a reconciliation route without moving its established URL", () => {
    const html = renderToStaticMarkup(
      <MobileNavigation
        basePath="/app"
        destination="reconciliation"
        items={navigationItems}
      />,
    );

    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="/app/reconciliation"');
  });
});
