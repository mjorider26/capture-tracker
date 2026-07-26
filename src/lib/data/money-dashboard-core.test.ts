import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client";
import { buildMoneySummary, emptyMoneyFilter, parseMoneyFilter } from "./money-dashboard-core";

describe("money dashboard summary", () => {
  it("preserves review totals and ignores voided records", () => {
    expect(buildMoneySummary([
      { id: "pending", amount: new Prisma.Decimal(125), direction: "OUTFLOW", intent: "UNREVIEWED", status: "PENDING_REVIEW" },
      { id: "business", amount: new Prisma.Decimal(40), direction: "OUTFLOW", intent: "BUSINESS", status: "APPROVED" },
      { id: "personal", amount: new Prisma.Decimal(15), direction: "OUTFLOW", intent: "PERSONAL", status: "EXCLUDED" },
      { id: "mixed", amount: new Prisma.Decimal(20), direction: "OUTFLOW", intent: "MIXED", status: "APPROVED" },
      { id: "voided", amount: new Prisma.Decimal(999), direction: "OUTFLOW", intent: "BUSINESS", status: "VOIDED" },
    ])).toEqual({ awaitingReviewCount: 1, reviewedBusinessAmount: "$40.00", excludedPersonalAmount: "$15.00", mixedCount: 1 });
  });

  it("starts filters from an empty business-scoped state", () => {
    expect(emptyMoneyFilter()).toEqual({ query: "", status: "", intent: "", accountId: "" });
  });

  it("retains only supported transaction filter values", () => {
    expect(parseMoneyFilter({ q: "  office  ", status: "APPROVED", intent: "BUSINESS", account: "account-1" })).toEqual({ query: "office", status: "APPROVED", intent: "BUSINESS", accountId: "account-1" });
    expect(parseMoneyFilter({ status: "POSTED", intent: "UNKNOWN", account: ["not-used"] })).toEqual(emptyMoneyFilter());
  });
});
