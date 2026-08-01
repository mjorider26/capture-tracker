import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client";
import { paymentTotals, taxPaymentSchema } from "./tax-payment-core";

const valid = { estimateId: "estimate-1", expectedVersion: "1", amount: "12.34", paidAt: "2026-08-15", confirmationNumber: "external-confirmation", notes: "Recorded from external payment site", idempotencyKey: "123e4567-e89b-42d3-a456-426614174001" };

describe("external tax payment validation", () => {
  it("accepts exact positive payments and preserves optional external references", () => {
    expect(taxPaymentSchema.parse(valid)).toMatchObject({ amount: "12.34", confirmationNumber: "external-confirmation" });
  });
  it("rejects invalid monetary values and invalid dates", () => {
    expect(taxPaymentSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(taxPaymentSchema.safeParse({ ...valid, paidAt: "not-a-date" }).success).toBe(false);
  });
  it("uses exact decimals and excludes non-recorded payments from the remaining estimate", () => {
    const totals = paymentTotals(new Prisma.Decimal("100.00"), [{ amount: new Prisma.Decimal("12.34"), status: "RECORDED" }, { amount: new Prisma.Decimal("20.00"), status: "PLANNED" }]);
    expect(totals.paid.toFixed(2)).toBe("12.34");
    expect(totals.remaining.toFixed(2)).toBe("87.66");
  });
});
