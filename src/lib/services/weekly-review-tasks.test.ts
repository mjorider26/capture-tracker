import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadWeeklyReviewTaskCount, loadWeeklyReviewTasks } from "./weekly-review-tasks";

const amount = (value: string) => ({ toFixed: () => value });
const date = new Date("2026-08-01T12:00:00.000Z");

function client() {
  const calls: Array<{ model: string; where: unknown }> = [];
  const findMany = <T,>(model: string, result: T[]) => async ({ where }: { where: unknown }) => {
    calls.push({ model, where });
    return result;
  };
  return {
    calls,
    client: {
      transaction: { findMany: findMany("transaction", [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }]) },
      document: { findMany: findMany("document", []) },
      documentMatchSuggestion: { findMany: findMany("documentMatchSuggestion", []) },
      reconciliationItem: { findMany: findMany("reconciliationItem", []) },
      statementActivity: { findMany: findMany("statementActivity", []) },
      quarterlyTaxEstimate: { findMany: findMany("quarterlyTaxEstimate", []) },
    },
  };
}

describe("loadWeeklyReviewTasks", () => {
  it("loads only business-scoped actionable records and shares its count", async () => {
    const harness = client();
    const tasks = await loadWeeklyReviewTasks(harness.client as never, "business-a");

    expect(tasks.map((task) => task.id)).toEqual(["transaction-awaiting-review:tx-1"]);
    expect(harness.calls).toHaveLength(6);
    expect(harness.calls.every((call) => (call.where as { businessId: string }).businessId === "business-a")).toBe(true);
    await expect(loadWeeklyReviewTaskCount(harness.client as never, "business-b")).resolves.toBe(1);
    expect(harness.calls.slice(6).every((call) => (call.where as { businessId: string }).businessId === "business-b")).toBe(true);
  });
});
