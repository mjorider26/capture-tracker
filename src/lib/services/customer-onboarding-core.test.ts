import { describe, expect, it } from "vitest";

import { planOpeningBalanceLines } from "./customer-onboarding-core";

describe("customer onboarding opening balance plan", () => {
  it("balances multiple bank and credit-card accounts with one retained-earnings offset", () => {
    const result = planOpeningBalanceLines([
      { id: "checking", type: "CHECKING", ledgerAccountId: "bank", amount: "1250.00" },
      { id: "savings", type: "SAVINGS", ledgerAccountId: "savings", amount: "500.00" },
      { id: "card", type: "CREDIT_CARD", ledgerAccountId: "card", amount: "225.00" },
    ], "retained");
    expect(result.balanced).toBe(true);
    expect(result.totalDebit.toFixed(2)).toBe("1750.00");
    expect(result.totalCredit.toFixed(2)).toBe("1750.00");
    expect(result.lines).toHaveLength(4);
  });

  it("creates no journal lines for an all-zero supported start", () => {
    const result = planOpeningBalanceLines([{ id: "checking", type: "CHECKING", ledgerAccountId: "bank", amount: "0.00" }], "retained");
    expect(result).toMatchObject({ lines: [], balanced: true });
  });

  it("rejects negative amounts rather than inventing direction", () => {
    expect(() => planOpeningBalanceLines([{ id: "checking", type: "CHECKING", ledgerAccountId: "bank", amount: "-1.00" }], "retained")).toThrow();
  });
});
