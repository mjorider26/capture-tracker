import { describe, expect, it } from "vitest";

import {
  buildWeeklyReviewTasks,
  countWeeklyReviewTasks,
  type WeeklyReviewTaskRecords,
} from "./weekly-review-tasks-core";

const amount = (value: string) => ({ toFixed: () => value });
const date = new Date("2026-08-01T12:00:00.000Z");

function records(overrides: Partial<WeeklyReviewTaskRecords> = {}): WeeklyReviewTaskRecords {
  return {
    transactions: [],
    documents: [],
    matchSuggestions: [],
    reconciliationItems: [],
    statementActivities: [],
    taxEstimates: [],
    ...overrides,
  };
}

describe("per-record weekly review tasks", () => {
  it("returns an empty task state", () => {
    expect(buildWeeklyReviewTasks(records())).toEqual([]);
  });

  it("creates an individual unresolved transaction task", () => {
    const tasks = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }] }));
    expect(tasks).toContainEqual(expect.objectContaining({ id: "transaction-awaiting-review:tx-1", href: "/money/tx-1", state: "UNRESOLVED" }));
  });

  it("creates a missing-classification task", () => {
    const tasks = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "UNREVIEWED", splits: [] }] }));
    expect(tasks.map((task) => task.id)).toContain("transaction-missing-classification:tx-1");
  });

  it("keeps multiple independent conditions on one transaction", () => {
    const tasks = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-1", description: "Client dinner", postedAt: date, amount: amount("120.00"), status: "PENDING_REVIEW", intent: "MIXED", splits: [{ amount: amount("100.00") }] }] }));
    expect(tasks.map((task) => task.id)).toEqual(["transaction-awaiting-review:tx-1", "transaction-invalid-mixed-split:tx-1"]);
  });

  it("creates a document-review task", () => {
    const tasks = buildWeeklyReviewTasks(records({ documents: [{ id: "doc-1", displayName: "July receipt", uploadedAt: date, status: "PENDING_VALIDATION", malwareScanStatus: "NOT_STARTED", extractionAttempts: [] }] }));
    expect(tasks).toContainEqual(expect.objectContaining({ id: "document-review:doc-1", href: "/documents/doc-1" }));
  });

  it("creates one extraction task for each actionable candidate", () => {
    const tasks = buildWeeklyReviewTasks(records({ documents: [{ id: "doc-1", displayName: "July receipt", uploadedAt: date, status: "ACTIVE", malwareScanStatus: "CLEAN", extractionAttempts: [{ status: "COMPLETED", candidates: [{ id: "candidate-1", fieldType: "TOTAL_AMOUNT", reviewState: "UNREVIEWED" }] }] }] }));
    expect(tasks.map((task) => task.id)).toEqual(["extraction-candidate:candidate-1"]);
  });

  it("creates a matching task only for a current actionable suggestion", () => {
    const tasks = buildWeeklyReviewTasks(records({ matchSuggestions: [{ id: "match-1", status: "SUGGESTED", score: 91, transactionAmount: amount("12.00"), transactionPostedAt: date, run: { status: "COMPLETED", document: { id: "doc-1", displayName: "July receipt", malwareScanStatus: "CLEAN" } } }] }));
    expect(tasks).toContainEqual(expect.objectContaining({ id: "document-match:match-1", href: "/documents/doc-1" }));
  });

  it("creates an unreconciled-transaction task", () => {
    const tasks = buildWeeklyReviewTasks(records({ reconciliationItems: [{ id: "item-1", status: "OUTSTANDING", reconciliation: { id: "recon-1", status: "IN_PROGRESS", statementEndDate: date, financialAccount: { name: "Checking" } }, transaction: { id: "tx-1", description: "Office supplies", amount: amount("25.00"), postedAt: date } }] }));
    expect(tasks).toContainEqual(expect.objectContaining({ id: "unreconciled-transaction:recon-1:tx-1", category: "Reconciliation", href: "/money/reconciliations/recon-1" }));
  });

  it("keeps stable identity and deduplicates duplicate source rows", () => {
    const transaction = { id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] };
    const first = buildWeeklyReviewTasks(records({ transactions: [transaction, transaction] }));
    const second = buildWeeklyReviewTasks(records({ transactions: [transaction] }));
    expect(first.map((task) => task.id)).toEqual(second.map((task) => task.id));
    expect(first).toHaveLength(1);
  });

  it("resolves tasks after the underlying action changes the record", () => {
    const unresolved = records({ transactions: [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "UNREVIEWED", splits: [] }] });
    const resolved = records({ transactions: [{ ...unresolved.transactions[0], status: "APPROVED", intent: "BUSINESS" }] });
    expect(countWeeklyReviewTasks(buildWeeklyReviewTasks(unresolved))).toBe(2);
    expect(countWeeklyReviewTasks(buildWeeklyReviewTasks(resolved))).toBe(0);
  });

  it("resolves a tax task once the supported payment workflow covers the estimate", () => {
    const outstanding = records({ taxEstimates: [{ id: "tax-1", status: "READY_FOR_REVIEW", taxYear: 2026, quarter: 3, jurisdictionCode: "US", dueDate: date, recommendedPayment: amount("500.00"), payments: [] }] });
    const paid = records({ taxEstimates: [{ ...outstanding.taxEstimates[0], payments: [{ amount: amount("500.00"), status: "RECORDED" }] }] });
    expect(buildWeeklyReviewTasks(outstanding).map((task) => task.id)).toEqual(["quarterly-tax-estimate:tax-1"]);
    expect(buildWeeklyReviewTasks(paid)).toEqual([]);
  });

  it("surfaces each required missing payroll evidence component once and resolves it after a match", () => {
    const zero = { isZero: () => true };
    const nonZero = { isZero: () => false };
    const run = { id: "pay-1", payDate: date, netPay: nonZero, employeeWithholding: nonZero, employeePayrollTax: zero, otherDeductions: zero, employerPayrollTax: zero, providerFee: nonZero, matches: [] };
    const missing = buildWeeklyReviewTasks(records({ payrollRuns: [run] }));
    expect(missing.map((task) => task.id)).toEqual([
      "payroll-evidence-missing:pay-1:NET_PAY",
      "payroll-evidence-missing:pay-1:PAYROLL_TAX",
      "payroll-evidence-missing:pay-1:PROVIDER_FEE",
    ]);
    const resolved = {
      ...run,
      matches: [
        { kind: "NET_PAY", status: "MATCHED" },
        { kind: "PAYROLL_TAX", status: "MATCHED" },
        { kind: "PROVIDER_FEE", status: "MATCHED" },
      ],
    };
    expect(buildWeeklyReviewTasks(records({ payrollRuns: [resolved] }))).toEqual([]);
  });

  it("does not hide unresolved tasks when a review is completed", () => {
    const tasks = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }] }));
    expect(countWeeklyReviewTasks(tasks)).toBe(1);
    expect(tasks[0]?.state).toBe("UNRESOLVED");
  });

  it("omits stale targets that cannot safely be acted on", () => {
    const tasks = buildWeeklyReviewTasks(records({
      documents: [{ id: "doc-1", displayName: "Old receipt", uploadedAt: date, status: "ACTIVE", malwareScanStatus: "CLEAN", extractionAttempts: [{ status: "STALE", candidates: [{ id: "candidate-1", fieldType: "TOTAL_AMOUNT", reviewState: "UNREVIEWED" }] }] }],
      matchSuggestions: [{ id: "match-1", status: "SUGGESTED", score: 91, transactionAmount: amount("12.00"), transactionPostedAt: date, run: { status: "STALE", document: { id: "doc-1", displayName: "Old receipt", malwareScanStatus: "CLEAN" } } }],
      reconciliationItems: [{ id: "item-1", status: "OUTSTANDING", reconciliation: { id: "recon-1", status: "COMPLETED", statementEndDate: date, financialAccount: { name: "Checking" } }, transaction: { id: "tx-1", description: "Office supplies", amount: amount("25.00"), postedAt: date } }],
    }));
    expect(tasks).toEqual([]);
  });

  it("does not mix records supplied by another tenant", () => {
    const businessA = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-a", description: "Business A", postedAt: date, amount: amount("10.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }] }));
    const businessB = buildWeeklyReviewTasks(records({ transactions: [{ id: "tx-b", description: "Business B", postedAt: date, amount: amount("20.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }] }));
    expect(businessA.map((task) => task.id)).toEqual(["transaction-awaiting-review:tx-a"]);
    expect(businessB.map((task) => task.id)).toEqual(["transaction-awaiting-review:tx-b"]);
  });

  it("uses the same task count for Today and Weekly Review", () => {
    const tasks = buildWeeklyReviewTasks(records({
      transactions: [{ id: "tx-1", description: "Office supplies", postedAt: date, amount: amount("25.00"), status: "PENDING_REVIEW", intent: "BUSINESS", splits: [] }],
      taxEstimates: [{ id: "tax-1", status: "READY_FOR_REVIEW", taxYear: 2026, quarter: 3, jurisdictionCode: "US", dueDate: date, recommendedPayment: amount("500.00"), payments: [] }],
    }));
    const weeklyReviewCount = countWeeklyReviewTasks(tasks);
    const todayCount = countWeeklyReviewTasks(tasks);
    expect(todayCount).toBe(weeklyReviewCount);
  });

  it("keeps pending scans informational while making scan failures and rejections actionable", () => {
    const tasks = buildWeeklyReviewTasks(records({ documents: [
      { id: "pending", displayName: "Pending receipt", uploadedAt: date, status: "QUARANTINED", malwareScanStatus: "PENDING", extractionAttempts: [] },
      { id: "failed", displayName: "Failed receipt", uploadedAt: date, status: "QUARANTINED", malwareScanStatus: "FAILED", extractionAttempts: [] },
      { id: "rejected", displayName: "Rejected receipt", uploadedAt: date, status: "REJECTED", malwareScanStatus: "INFECTED", extractionAttempts: [] },
    ] }));
    expect(tasks.map((task) => task.id)).toEqual(["document-scan-failed:failed", "document-security-rejected:rejected"]);
  });
});
