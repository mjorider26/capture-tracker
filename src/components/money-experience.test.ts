import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { MoneyExperience } from "./money-experience";
import type { MoneyDashboard } from "@/lib/data/money-dashboard";
import type { MoneyOperationsSummary } from "@/lib/data/money-operations";

const dashboard = {
  businessName: "Empty Books",
  summary: { awaitingReviewCount: 0, reviewedBusinessAmount: "$0.00", excludedPersonalAmount: "$0.00", mixedCount: 0, resultCount: 0, accountCount: 1 },
  filters: { query: "", status: "", intent: "", accountId: "" },
  accounts: [{ id: "checking", name: "Business Checking" }],
  transactions: [],
} satisfies MoneyDashboard;

const operations: MoneyOperationsSummary = {
  invoices: { openAmount: "0.00", openCount: 0, overdueCount: 0 },
  bills: { dueAmount: "0.00", dueCount: 0, upcomingCount: 0 },
  mileage: { milesThisYear: "0.00", tripCount: 0, unclaimedCount: 0 },
  bank: { connectionCount: 0 },
  cpa: { acceptedCount: 0, pendingCount: 0 },
};

describe("Money transaction-entry presentation", () => {
  it("shows the empty-account action without misleading search language", () => {
    const html = renderToStaticMarkup(createElement(MoneyExperience, { dashboard, basePath: "/app" }));
    expect(html).toContain("No transactions yet.");
    expect(html).toContain('href="/app/money/new"');
    expect(html).not.toContain("No transactions match");
  });

  it("makes every owner-facing V2.2 workflow reachable from Money", () => {
    const html = renderToStaticMarkup(createElement(MoneyExperience, { dashboard, operations, canManageCpa: true, basePath: "/app" }));

    [
      "/app/money/invoices",
      "/app/money/bills",
      "/app/taxes/mileage",
      "/app/money/bank",
      "/app/settings/cpa",
      "/app/reports/operations?report=ar-aging",
      "/app/reports/operations?report=ap-aging",
    ].forEach((href) => expect(html).toContain(`href="${href}"`));
    expect(html).toContain("Live provider not configured");
    expect(html).toContain("No CPA currently has access");
  });
});
