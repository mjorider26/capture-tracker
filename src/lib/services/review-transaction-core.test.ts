import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client";
import { buildMoneySummary } from "../data/money-dashboard-core";
import {
  isTransactionReviewLocked,
  reviewOutcomeForIntent,
  splitTotalEqualsParent,
  validateReviewSubmission,
} from "./review-transaction-core";

const base = {
  transactionId: "transaction_1",
  expectedVersion: "1",
  intent: "MIXED" as const,
};

describe("review transaction validation", () => {
  it("accepts an exact mixed review and uses Decimal arithmetic", () => {
    const result = validateReviewSubmission({
      ...base,
      splits: [
        { intent: "BUSINESS", amount: "100.10" },
        { intent: "PERSONAL", amount: "49.90" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(
      splitTotalEqualsParent(
        [{ amount: "100.10" }, { amount: "49.90" }],
        new Prisma.Decimal("150.00"),
      ),
    ).toBe(true);
  });
  it("maps business, personal, and mixed reviews to established statuses", () => {
    expect(reviewOutcomeForIntent("BUSINESS")).toEqual({
      intent: "BUSINESS",
      status: "APPROVED",
    });
    expect(reviewOutcomeForIntent("PERSONAL")).toEqual({
      intent: "PERSONAL",
      status: "EXCLUDED",
    });
    expect(reviewOutcomeForIntent("MIXED")).toEqual({
      intent: "MIXED",
      status: "APPROVED",
    });
  });
  it("protects posted and locked accounting history", () => {
    expect(
      isTransactionReviewLocked({
        status: "PENDING_REVIEW",
        journalStatus: "POSTED",
        accountingPeriodStatus: "OPEN",
      }),
    ).toBe(true);
    expect(
      isTransactionReviewLocked({
        status: "PENDING_REVIEW",
        journalStatus: null,
        accountingPeriodStatus: "LOCKED",
      }),
    ).toBe(true);
  });
  it.each(["", "1e2", "1.234", "-1.00", "0", "Infinity", "NaN"])(
    "rejects invalid split amount %s",
    (amount) => {
      expect(
        validateReviewSubmission({
          ...base,
          splits: [
            { intent: "BUSINESS", amount },
            { intent: "PERSONAL", amount: "1.00" },
          ],
        }).ok,
      ).toBe(false);
    },
  );
  it("rejects totals that do not equal the parent exactly", () => {
    expect(
      splitTotalEqualsParent(
        [{ amount: "100.00" }, { amount: "49.99" }],
        new Prisma.Decimal("150.00"),
      ),
    ).toBe(false);
  });
  it("requires exact integer version text", () => {
    expect(
      validateReviewSubmission({
        ...base,
        expectedVersion: "1.0",
        splits: [
          { intent: "BUSINESS", amount: "1.00" },
          { intent: "PERSONAL", amount: "1.00" },
        ],
      }).ok,
    ).toBe(false);
  });
  it("keeps money summaries scoped to supplied records", () => {
    const summary = buildMoneySummary([
      {
        id: "a",
        amount: new Prisma.Decimal("5.00"),
        direction: "OUTFLOW",
        intent: "BUSINESS",
        status: "APPROVED",
      },
    ]);
    expect(summary).toMatchObject({
      reviewedBusinessAmount: "$5.00",
      awaitingReviewCount: 0,
    });
  });
});
