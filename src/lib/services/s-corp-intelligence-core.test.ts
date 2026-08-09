import { describe, expect, it } from "vitest";

import { basisStatus, booksCurrentThrough, distributionReadiness } from "./s-corp-intelligence-core";

describe("S-Corp intelligence safeguards", () => {
  it("never treats unknown opening basis as zero", () => expect(basisStatus({ openingStockBasis: null, taxYear: 2026, reviewedAt: null, hasUnresolvedItems: false })).toBe("INCOMPLETE"));
  it("keeps stock basis review separate from debt and book equity", () => expect(basisStatus({ openingStockBasis: "10.00", taxYear: 2026, reviewedAt: new Date("2026-12-31"), hasUnresolvedItems: true })).toBe("CPA_REVIEW"));
  it("blocks distribution review for bookkeeping blockers and never approves it", () => {
    expect(distributionReadiness({ unreconciledAccounts: 1, unresolvedActivity: 0, payrollMismatch: false, basisStatus: "CURRENT", compensationReviewStale: false, reimbursementsDue: 0 })).toBe("BLOCKED_BY_BOOKKEEPING");
    expect(distributionReadiness({ unreconciledAccounts: 0, unresolvedActivity: 0, payrollMismatch: false, basisStatus: "INCOMPLETE", compensationReviewStale: false, reimbursementsDue: 0 })).toBe("CPA_REVIEW_RECOMMENDED");
  });
  it("keeps future blockers from regressing an evidenced historic completion date", () => {
    expect(booksCurrentThrough(new Date("2026-08-07"), [new Date("2026-08-08"), new Date("2026-09-01")])?.toISOString().slice(0, 10)).toBe("2026-08-07");
    expect(booksCurrentThrough(new Date("2026-08-07"), [new Date("2026-09-01")])?.toISOString().slice(0, 10)).toBe("2026-08-07");
    expect(booksCurrentThrough(new Date("2026-08-07"), [new Date("2026-08-05")])?.toISOString().slice(0, 10)).toBe("2026-08-04");
  });
});
