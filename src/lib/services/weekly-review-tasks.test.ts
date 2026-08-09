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
      externalTransaction: { findMany: findMany("externalTransaction", []) },
      ownerMoneyTransfer: { findMany: findMany("ownerMoneyTransfer", []) },
      payrollBankMatch: { findMany: findMany("payrollBankMatch", []) },
      payrollRun: { findMany: findMany("payrollRun", []) },
      fixedAsset: { findMany: findMany("fixedAsset", []) },
    },
  };
}

describe("loadWeeklyReviewTasks", () => {
  it("loads only business-scoped actionable records and shares its count", async () => {
    const harness = client();
    const tasks = await loadWeeklyReviewTasks(harness.client as never, "business-a");

    expect(tasks.map((task) => task.id)).toEqual(["transaction-awaiting-review:tx-1"]);
    expect(harness.calls).toHaveLength(11);
    expect(harness.calls.every((call) => (call.where as { businessId: string }).businessId === "business-a")).toBe(true);
    await expect(loadWeeklyReviewTaskCount(harness.client as never, "business-b")).resolves.toBe(1);
    expect(harness.calls.slice(11).every((call) => (call.where as { businessId: string }).businessId === "business-b")).toBe(true);
  });

  it("starts each independent business-scoped reader before waiting for results", async () => {
    const pending: Array<() => void> = [];
    const started: string[] = [];
    const delayed = (model: string) => () => new Promise<never[]>((resolve) => {
      started.push(model);
      pending.push(() => resolve([]));
    });
    const harness = {
      transaction: { findMany: delayed("transaction") },
      document: { findMany: delayed("document") },
      documentMatchSuggestion: { findMany: delayed("match") },
      reconciliationItem: { findMany: delayed("reconciliation") },
      statementActivity: { findMany: delayed("statement") },
      quarterlyTaxEstimate: { findMany: delayed("tax") },
      externalTransaction: { findMany: delayed("external") },
      ownerMoneyTransfer: { findMany: delayed("ownerTransfer") },
      payrollBankMatch: { findMany: delayed("payrollMatch") },
      payrollRun: { findMany: delayed("payrollRun") },
      fixedAsset: { findMany: delayed("fixedAsset") },
    };

    const loading = loadWeeklyReviewTasks(harness as never, "business-a");

    expect(started).toEqual([
      "transaction",
      "document",
      "match",
      "reconciliation",
      "statement",
      "tax",
      "external",
      "ownerTransfer",
      "payrollMatch",
      "payrollRun",
      "fixedAsset",
    ]);
    pending.forEach((resolve) => resolve());
    await expect(loading).resolves.toEqual([]);
  });
});
