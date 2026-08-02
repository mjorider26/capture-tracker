import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TodayExperience } from "./today-experience";
import type { TodayDashboard } from "@/lib/data/today-dashboard";

const dashboard: TodayDashboard = {
  businessName: "Northstar Field Solutions",
  availableCash: {
    value: "$3,550.00",
    explanation:
      "Approved cash activity is available for current business decisions.",
    status: "positive",
  },
  currentActivity: {
    income: "$5,000.00",
    expenses: "$1,450.00",
    unreviewedTransactions: 1,
    documentAttention: 2,
  },
  isEmptyAccount: false,
  taxReserve: {
    value: "Not configured",
    explanation: "No dedicated reserve account is configured.",
    status: "unavailable",
  },
  projectedTax: {
    value: "$1,500.00",
    explanation: "Current estimated tax obligation.",
    status: "attention",
    dueDate: "Sep 15",
  },
  reservePosition: {
    value: "-$1,500.00",
    explanation: "Funding attention.",
    status: "gap",
  },
  cashVisual: {
    availableCash: "$3,550.00",
    dedicatedReserve: null,
    reserveSharePercent: null,
  },
  attention: [
    {
      id: "transactions",
      count: 1,
      label: "Transactions awaiting review",
      description:
        "Classify pending business activity before it reaches the books.",
      destination: "money",
      tone: "urgent",
    },
  ],
  weeklyReview: {
    status: "IN_PROGRESS",
    estimatedMinutes: 10,
    tasks: [
      {
        id: "review-task",
        category: "Transactions",
        title: "Review a transaction",
        explanation: "Classify the transaction.",
        detail: "Pending review",
        href: "/money",
        state: "UNRESOLVED",
      },
    ],
  },
  changes: [
    {
      id: "entry-1",
      title: "Commission income received",
      date: "Aug 1, 2026",
      amount: "$5,000.00",
      explanation: "Commission income increased business checking.",
      tone: "income",
    },
  ],
};

describe("TodayExperience", () => {
  it("keeps the briefing, open attention, and protected destinations in a clear order", () => {
    const html = renderToStaticMarkup(
      <TodayExperience dashboard={dashboard} basePath="/app" />,
    );

    expect(html).toContain("Financial briefing");
    expect(html).toContain("Needs your attention");
    expect(html).toContain("Protected workflows");
    expect(html).toContain("/app/money");
    expect(html).toContain("Read-only financial view");
  });

  it("renders a truthful empty account call to the existing transaction workflow", () => {
    const html = renderToStaticMarkup(
      <TodayExperience
        dashboard={{ ...dashboard, isEmptyAccount: true, attention: [] }}
        basePath="/demo"
      />,
    );

    expect(html).toContain("Add your first transaction");
    expect(html).toContain("/demo/money/new");
    expect(html).toContain("Nothing is waiting for review");
  });
});
