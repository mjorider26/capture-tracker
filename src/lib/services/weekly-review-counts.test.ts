import { describe, expect, it } from "vitest";

import { loadWeeklyReviewAttention } from "./weekly-review-counts";

type CountCall = { model: string; where: { businessId: string } };

function createCountClient() {
  const calls: CountCall[] = [];
  let activeReads = 0;
  let peakActiveReads = 0;
  let disconnectCalls = 0;

  const count = (model: string, result: number) =>
    async ({ where }: { where: { businessId: string } }) => {
      calls.push({ model, where });
      activeReads += 1;
      peakActiveReads = Math.max(peakActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeReads -= 1;
      return result;
    };

  return {
    client: {
      transaction: { count: count("transaction", 1) },
      document: { count: count("document", 2) },
      documentMatchSuggestion: { count: count("documentMatchSuggestion", 3) },
      reconciliation: { count: count("reconciliation", 4) },
      quarterlyTaxEstimate: { count: count("quarterlyTaxEstimate", 5) },
      payrollRun: { count: count("payrollRun", 6) },
      $disconnect: () => {
        disconnectCalls += 1;
      },
    },
    calls,
    get peakActiveReads() {
      return peakActiveReads;
    },
    get disconnectCalls() {
      return disconnectCalls;
    },
  };
}

describe("loadWeeklyReviewAttention", () => {
  it("loads the unchanged business-scoped counts one at a time", async () => {
    const harness = createCountClient();

    await expect(
      loadWeeklyReviewAttention(harness.client as never, "business-a"),
    ).resolves.toEqual({
      transactions: 1,
      documents: 2,
      matches: 3,
      reconciliations: 4,
      tax: 5,
      payroll: 6,
      total: 21,
    });

    expect(harness.calls.map((call) => call.model)).toEqual([
      "transaction",
      "document",
      "documentMatchSuggestion",
      "reconciliation",
      "quarterlyTaxEstimate",
      "payrollRun",
    ]);
    expect(harness.peakActiveReads).toBe(1);
    expect(harness.calls.every((call) => call.where.businessId === "business-a")).toBe(
      true,
    );
    expect(harness.calls[1].where).toEqual({
      businessId: "business-a",
      OR: [
        { status: "PENDING_VALIDATION" },
        { status: "QUARANTINED", malwareScanStatus: { not: "PENDING" } },
        { status: "REJECTED" },
        { extractionAttempts: { some: { status: { in: ["FAILED", "STALE"] } } } },
        { transactions: { none: { unlinkedAt: null } }, status: "ACTIVE", malwareScanStatus: "CLEAN" },
      ],
    });
  });

  it("reuses the client for repeated loads without disconnecting or mutating data", async () => {
    const harness = createCountClient();

    await loadWeeklyReviewAttention(harness.client as never, "business-a");
    await loadWeeklyReviewAttention(harness.client as never, "business-b");

    expect(harness.calls).toHaveLength(12);
    expect(harness.calls.slice(0, 6).every((call) => call.where.businessId === "business-a")).toBe(
      true,
    );
    expect(harness.calls.slice(6).every((call) => call.where.businessId === "business-b")).toBe(
      true,
    );
    expect(harness.peakActiveReads).toBe(1);
    expect(harness.disconnectCalls).toBe(0);
  });
});
