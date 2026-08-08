import { describe, expect, it } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import { balancedJournalEntry, closeReadiness } from "./close-core";
describe("month-end close core", () => {
  it("blocks close for any unresolved deterministic exception", () => {
    const readiness = closeReadiness([{ key: "imports", label: "Imports", count: 1, detail: "Review" }, { key: "integrity", label: "Integrity", count: 0, detail: "Pass" }]);
    expect(readiness.status).toBe("NOT_READY");
    expect(readiness.blockers).toHaveLength(1);
  });
  it("requires balanced non-empty journals", () => {
    expect(balancedJournalEntry([{ debitAmount: new Prisma.Decimal("10"), creditAmount: new Prisma.Decimal(0) }, { debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal("10") }])).toBe(true);
    expect(balancedJournalEntry([{ debitAmount: new Prisma.Decimal("10"), creditAmount: new Prisma.Decimal(0) }])).toBe(false);
  });
});
