import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { MoneyExperience } from "./money-experience";
import type { MoneyDashboard } from "@/lib/data/money-dashboard";

const dashboard = {
  businessName: "Empty Books",
  summary: { awaitingReviewCount: 0, reviewedBusinessAmount: "$0.00", excludedPersonalAmount: "$0.00", mixedCount: 0, resultCount: 0, accountCount: 1 },
  filters: { query: "", status: "", intent: "", accountId: "" },
  accounts: [{ id: "checking", name: "Business Checking" }],
  transactions: [],
} satisfies MoneyDashboard;

describe("Money transaction-entry presentation", () => {
  it("shows the empty-account action without misleading search language", () => {
    const html = renderToStaticMarkup(createElement(MoneyExperience, { dashboard, basePath: "/app" }));
    expect(html).toContain("No transactions yet.");
    expect(html).toContain('href="/app/money/new"');
    expect(html).not.toContain("No transactions match");
  });
});
