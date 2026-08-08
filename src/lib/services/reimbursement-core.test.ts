import { describe, expect, it } from "vitest";
import { reimbursementExpenseSchema } from "./reimbursement-core";

const valid = { incurredAt: "2026-08-08", amount: "48.21", expenseType: "SUPPLIES", businessPurpose: "Materials used for the client engagement", merchantName: "Fictional Supply Co.", notes: "Personally paid", idempotencyKey: "123e4567-e89b-42d3-a456-426614174001" };
describe("personally paid reimbursement validation", () => {
  it("accepts a documented business expense with exact money", () => {
    expect(reimbursementExpenseSchema.parse(valid)).toMatchObject({ amount: "48.21", documentId: null });
  });
  it("rejects unsupported amounts, dates, and missing purpose", () => {
    expect(reimbursementExpenseSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(reimbursementExpenseSchema.safeParse({ ...valid, incurredAt: "invalid" }).success).toBe(false);
    expect(reimbursementExpenseSchema.safeParse({ ...valid, businessPurpose: "" }).success).toBe(false);
  });
});
