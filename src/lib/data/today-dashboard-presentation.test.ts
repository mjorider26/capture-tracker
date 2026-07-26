import { describe, expect, it } from "vitest";

import { prioritizeTodayAttention } from "./today-dashboard-presentation";

describe("Today dashboard presentation", () => {
  it("preserves the existing attention categories and their safe destinations", () => {
    const attention = prioritizeTodayAttention({
      transactions: 1,
      documents: 2,
      matches: 3,
      reconciliations: 4,
      tax: 5,
      payroll: 6,
      reviewTasks: 7,
    });

    expect(attention.map(({ id, destination, count }) => ({ id, destination, count }))).toEqual([
      { id: "transactions", destination: "money", count: 1 },
      { id: "reconciliations", destination: "money", count: 4 },
      { id: "documents", destination: "documents", count: 2 },
      { id: "matches", destination: "documents", count: 3 },
      { id: "tax", destination: "taxes", count: 5 },
      { id: "payroll", destination: "taxes", count: 6 },
      { id: "reviewTasks", destination: "review", count: 7 },
    ]);
  });

  it("omits resolved categories", () => {
    expect(
      prioritizeTodayAttention({
        transactions: 0,
        documents: 0,
        matches: 0,
        reconciliations: 0,
        tax: 0,
        payroll: 0,
        reviewTasks: 0,
      }),
    ).toEqual([]);
  });
});
