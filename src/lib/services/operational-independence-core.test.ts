import { describe, expect, it } from "vitest";
import { FakeBankProvider, accountingBasisFromPolicy, canMutateBusiness, decideSync, mileageAmount, openItemAge, paymentStatus } from "./operational-independence-core";

describe("operational independence safety core", () => {
  it("does not invent an accounting basis", () => { expect(accountingBasisFromPolicy(null)).toBe("NEEDS_REVIEW"); expect(accountingBasisFromPolicy("Cash basis" )).toBe("CASH"); expect(accountingBasisFromPolicy("Accrual basis")).toBe("ACCRUAL"); });
  it("keeps ordinary future receivables current and ages only overdue items", () => { const now = new Date("2026-08-08T12:00:00Z"); expect(paymentStatus("100", "0", true, new Date("2026-09-01T00:00:00Z"), now)).toBe("ISSUED"); expect(openItemAge(new Date("2026-04-01T00:00:00Z"), now)).toBe("90_PLUS"); });
  it("handles redelivery and pending-to-posted bank updates idempotently", () => { const incoming = { id: "p1", accountRef: "a", date: "2026-08-01", description: "Supplier", amount: "12.00", direction: "OUTFLOW" as const, pending: false, updatedAt: "2026-08-02" }; expect(decideSync(null, incoming)).toBe("CREATE"); expect(decideSync({ id: "p1", pending: true, updatedAt: "2026-08-01" }, incoming)).toBe("UPDATE"); expect(decideSync({ id: "p1", pending: false, updatedAt: "2026-08-02" }, incoming)).toBe("REDLIVERED"); });
  it("provides a deterministic fake provider and blocks CPA mutation", async () => { const provider = new FakeBankProvider([{ cursor: null, transactions: [] }]); expect((await provider.connect()).institutionName).toBe("Capture Test Bank"); expect(canMutateBusiness("CPA_READ_ONLY")).toBe(false); expect(mileageAmount("12.5", "0.70")).toBe("8.75"); });
});
