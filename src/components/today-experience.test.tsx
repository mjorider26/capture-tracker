import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TodayExperience } from "./today-experience";
import type { TodayDashboard } from "@/lib/data/today-dashboard";

const dashboard: TodayDashboard = {
  businessName: "Northstar Field Solutions",
  availableCash: { value: "$3,550.00", explanation: "Approved cash activity.", status: "positive" },
  currentActivity: { income: "$5,000.00", expenses: "$1,450.00", unreviewedTransactions: 1, documentAttention: 2 },
  booksCurrent: { date: "Aug 7, 2026", blocker: { label: "Imported activity", count: 1, date: "Aug 8, 2026" }, accountCoverage: [{ accountName: "Checking", reconciledThrough: "Aug 7, 2026" }] },
  isEmptyAccount: false,
  taxReserve: { value: "Not configured", explanation: "No dedicated reserve account.", status: "unavailable" },
  projectedTax: { value: "$1,500.00", explanation: "Current estimate.", status: "attention", dueDate: "Sep 15" },
  reservePosition: { value: "-$1,500.00", explanation: "Funding attention.", status: "gap" },
  cashVisual: { availableCash: "$3,550.00", dedicatedReserve: null, reserveSharePercent: null },
  attention: [{ id: "transactions", count: 1, label: "Transactions awaiting review", description: "Classify pending business activity before it reaches the books.", destination: "money", tone: "urgent" }],
  weeklyReview: { status: "IN_PROGRESS", estimatedMinutes: 10, tasks: [{ id: "review-task", category: "Transactions", title: "Review a transaction", explanation: "Classify the transaction.", detail: "Pending review", href: "/money", state: "UNRESOLVED" }] },
  changes: [],
};

describe("TodayExperience guided owner home", () => {
  it("orders book status, frequent actions, and genuine owner attention", () => {
    const html = renderToStaticMarkup(<TodayExperience dashboard={dashboard} basePath="/app" />);
    const books = html.indexOf("Books current through");
    const actions = html.indexOf("Quick owner actions");
    const attention = html.indexOf("What needs your attention");
    expect(books).toBeGreaterThan(-1); expect(actions).toBeGreaterThan(books); expect(attention).toBeGreaterThan(actions);
    ["Review activity", "Add receipt", "Create invoice", "Add bill", "Record mileage", "Owner Money"].forEach((label) => expect(html).toContain(label));
    expect(html).toContain("1 item is blocking Aug 8, 2026");
    expect(html).not.toContain("Available business cash");
  });

  it("shows a calm state without invented metrics when no work needs attention", () => {
    const html = renderToStaticMarkup(<TodayExperience dashboard={{ ...dashboard, attention: [], booksCurrent: { ...dashboard.booksCurrent, blocker: null }, weeklyReview: null }} basePath="/app" />);
    expect(html).toContain("You&#x27;re caught up.");
    expect(html).toContain("How this date works");
    expect(html).not.toContain("0% complete");
  });
});
