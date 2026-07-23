import { Prisma } from "../../generated/prisma/client";
import { describe, expect, it } from "vitest";

import {
  calculateCashBalance,
  calculateRemainingTaxObligation,
  calculateReservePosition,
  orderReviewTasks,
  selectLatestTaxEstimate,
} from "./today-dashboard-core";

const money = (value: string) => new Prisma.Decimal(value);

describe("Today dashboard calculations", () => {
  it("uses exact approved checking activity and excludes personal, credit-card, voided, and excluded activity", () => {
    const cash = calculateCashBalance([
      {
        openingBalance: money("100.00"),
        isTaxReserve: false,
        transactions: [
          { amount: money("1000.10"), direction: "INFLOW", status: "APPROVED" },
          { amount: money("200.05"), direction: "OUTFLOW", status: "APPROVED" },
          { amount: money("900.00"), direction: "INFLOW", status: "VOIDED" },
          { amount: money("8.00"), direction: "OUTFLOW", status: "EXCLUDED" },
        ],
      },
    ]);
    expect(cash.toFixed(2)).toBe("900.05");
  });

  it("selects the latest tax estimate and reduces it only by recorded payments", () => {
    const estimate = selectLatestTaxEstimate([
      {
        taxYear: 2026,
        quarter: 2,
        revisionNumber: 2,
        projectedTaxLiability: money("100.00"),
        withholdingCredits: money("0"),
        priorPayments: money("0"),
      },
      {
        taxYear: 2026,
        quarter: 3,
        revisionNumber: 1,
        projectedTaxLiability: money("1800.00"),
        withholdingCredits: money("300.00"),
        priorPayments: money("0"),
      },
    ]);
    expect(estimate?.quarter).toBe(3);
    expect(
      calculateRemainingTaxObligation(estimate!, [
        { amount: money("200.00"), status: "RECORDED" },
        { amount: money("900.00"), status: "PLANNED" },
      ]).toFixed(2),
    ).toBe("1300.00");
  });

  it("keeps missing reserve unknown and calculates exact gap or surplus", () => {
    expect(calculateReservePosition(null, money("1500"))).toBeNull();
    expect(
      calculateReservePosition(money("1000.00"), money("1500.00"))?.toFixed(2),
    ).toBe("-500.00");
    expect(
      calculateReservePosition(money("1700.00"), money("1500.00"))?.toFixed(2),
    ).toBe("200.00");
  });

  it("orders weekly-review tasks deterministically", () => {
    expect(
      orderReviewTasks([
        { id: "b", sortOrder: 2 },
        { id: "c", sortOrder: 1 },
        { id: "a", sortOrder: 1 },
      ]).map((task) => task.id),
    ).toEqual(["a", "c", "b"]);
  });
});
