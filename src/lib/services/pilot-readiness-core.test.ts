import { describe, expect, it } from "vitest";
import { parseSettingsInput, presentAuditEvent, sanitizeActivityEvents } from "./pilot-readiness-core";

describe("Activity presentation", () => {
  it("uses readable labels and safe record links without exposing audit data", () => {
    const event = presentAuditEvent({ id: "audit-private", entityType: "Transaction", entityId: "transaction-private", action: "SUPERSEDE", occurredAt: new Date("2026-08-01T12:00:00Z") });
    expect(event).toMatchObject({ module: "Transactions", label: "Transaction corrected", href: "/money/transaction-private" });
    expect(event.label).not.toContain("SUPERSEDE");
    expect(event.detail).not.toContain("private");
  });

  it("presents document, reconciliation, tax, and weekly-review-safe events", () => {
    expect(presentAuditEvent({ id: "d", entityType: "Document", entityId: "doc", action: "CREATE", occurredAt: new Date() }).label).toBe("Document uploaded");
    expect(presentAuditEvent({ id: "d-scan", entityType: "Document", entityId: "doc", action: "VALIDATE", occurredAt: new Date() }).label).toBe("Document security scan passed");
    expect(presentAuditEvent({ id: "d-rejected", entityType: "Document", entityId: "doc", action: "REJECT", occurredAt: new Date() }).label).toBe("Document rejected by security scan");
    expect(presentAuditEvent({ id: "r", entityType: "StatementActivity", entityId: "activity", action: "UPDATE", metadataJson: { statementActivityAction: "MATCH" }, occurredAt: new Date() }).label).toBe("Statement activity matched");
    expect(presentAuditEvent({ id: "t", entityType: "TaxPaymentRecord", entityId: "payment", action: "CREATE", occurredAt: new Date() }).href).toBe("/taxes/estimates");
    expect(presentAuditEvent({ id: "j", entityType: "JournalEntry", entityId: "journal", action: "CREATE", metadataJson: { reversal: true }, occurredAt: new Date() }).label).toBe("Transaction reversal created");
  });

  it("keeps bounded paginated results and supports an empty state", () => {
    const event = presentAuditEvent({ id: "a", entityType: "Transaction", entityId: "one", action: "CREATE", occurredAt: new Date("2026-08-01T12:00:00Z") });
    expect(sanitizeActivityEvents([], {}).total).toBe(0);
    expect(sanitizeActivityEvents(Array.from({ length: 8 }, (_, index) => ({ ...event, key: String(index), at: new Date(1000 + index) })), { size: "5", page: "2" }).events).toHaveLength(3);
  });
});

describe("Settings validation", () => {
  it("accepts persisted settings and rejects malformed or stale-version values", () => {
    const valid = new FormData(); valid.set("defaultReportPeriod", "month"); valid.set("weeklyReviewDay", "1"); valid.set("retentionMonths", "84"); valid.set("expectedUpdatedAt", "2026-08-01T12:00:00.000Z");
    expect(parseSettingsInput(valid)).toMatchObject({ weeklyReviewDay: 1 });
    valid.set("weeklyReviewDay", "9"); expect(parseSettingsInput(valid)).toBeNull();
    valid.set("weeklyReviewDay", "1"); valid.set("expectedUpdatedAt", "not-a-date"); expect(parseSettingsInput(valid)).toBeNull();
  });
});
