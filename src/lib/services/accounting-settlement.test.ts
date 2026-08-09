import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const foundation = vi.hoisted(() => ({ ensureWorkspaceAccountingFoundation: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/accounting/workspace-bootstrap", () => foundation);

import { matchPayrollEvidence, reversePayrollRun } from "./payroll";
import { approveReimbursementClaim, matchReimbursementPayment } from "./reimbursement-settlement";

const decimal = (value: string) => new Prisma.Decimal(value);
const actor = { businessId: "business-a", actorUserId: "member-a", actorMembershipId: "member-a", role: "OWNER" as const, executionMode: "authenticated" as const };
const transactionClient = (tx: Record<string, unknown>) => ({ $transaction: async (work: (database: typeof tx) => unknown) => work(tx) });

describe("payroll bank evidence", () => {
  const upsert = vi.fn();
  const audit = vi.fn();
  const run = { id: "payroll-a", netPay: decimal("100.00"), providerFee: decimal("10.00"), employeeWithholding: decimal("12.00"), employeePayrollTax: decimal("8.00"), otherDeductions: decimal("0.00"), employerPayrollTax: decimal("20.00") };
  const external = { id: "external-a", amount: decimal("100.00") };
  const tx = { payrollRun: { findFirst: vi.fn() }, externalTransaction: { findFirst: vi.fn() }, payrollBankMatch: { upsert }, auditEvent: { create: audit } };

  beforeEach(() => {
    vi.clearAllMocks();
    tx.payrollRun.findFirst.mockResolvedValue(run);
    tx.externalTransaction.findFirst.mockResolvedValue(external);
    upsert.mockResolvedValue({ id: "match-a" });
    audit.mockResolvedValue({ id: "audit-a" });
  });

  it("records matched, partial, difference, and missing-equivalent evidence without creating a journal", async () => {
    const client = transactionClient(tx) as never;
    for (const [actual, status] of [["100.00", "MATCHED"], ["40.00", "PARTIAL"], ["150.00", "DIFFERENCE"], ["0.00", "UNMATCHED"]] as const) {
      external.amount = decimal(actual);
      await expect(matchPayrollEvidence(client, actor, { payrollRunId: run.id, externalTransactionId: external.id, kind: "NET_PAY" })).resolves.toEqual({ ok: true, status });
    }
    expect(upsert).toHaveBeenCalledTimes(4);
    expect(upsert.mock.calls.map((call) => call[0].create.status)).toEqual(["MATCHED", "PARTIAL", "DIFFERENCE", "UNMATCHED"]);
    expect(upsert.mock.calls.every((call) => call[0].create.businessId === actor.businessId)).toBe(true);
  });

  it("uses the unique business/run/evidence/kind key on repeated delivery and denies a foreign payroll run", async () => {
    const client = transactionClient(tx) as never;
    await matchPayrollEvidence(client, actor, { payrollRunId: run.id, externalTransactionId: external.id, kind: "NET_PAY" });
    await matchPayrollEvidence(client, actor, { payrollRunId: run.id, externalTransactionId: external.id, kind: "NET_PAY" });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.every((call) => call[0].where.businessId_payrollRunId_externalTransactionId_kind.businessId === actor.businessId)).toBe(true);
    tx.payrollRun.findFirst.mockResolvedValueOnce(null);
    await expect(matchPayrollEvidence(client, actor, { payrollRunId: "other-business-run", externalTransactionId: external.id, kind: "NET_PAY" })).resolves.toMatchObject({ ok: false });
  });
});

describe("reimbursement settlement", () => {
  const journalCreate = vi.fn();
  const lineCreate = vi.fn();
  const journalUpdate = vi.fn();
  const claimUpdate = vi.fn();
  const audit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    foundation.ensureWorkspaceAccountingFoundation.mockResolvedValue(undefined);
    journalCreate.mockResolvedValue({ id: "journal-a" });
    lineCreate.mockResolvedValue({ count: 2 });
    journalUpdate.mockResolvedValue({ id: "journal-a" });
    claimUpdate.mockResolvedValue({ id: "claim-a" });
    audit.mockResolvedValue({ id: "audit-a" });
  });

  it("posts a personally paid business expense once as expense and reimbursement payable, never wages or distributions", async () => {
    const claim = { id: "claim-a", totalAmount: decimal("48.21"), expenses: [{ incurredAt: new Date("2026-08-08T12:00:00.000Z"), amount: decimal("48.21"), expenseType: "SUPPLIES", businessPurpose: "Fictional business supplies" }], journalEntry: null };
    const tx = {
      reimbursementClaim: { findFirst: vi.fn().mockResolvedValue(claim), update: claimUpdate },
      accountingPeriod: { findFirst: vi.fn().mockResolvedValue({ id: "period-a" }) },
      ledgerAccount: { findFirst: vi.fn().mockResolvedValue({ id: "payable-a" }), findMany: vi.fn().mockResolvedValue([{ id: "supplies-a", subtype: "OFFICE_SUPPLIES_EXPENSE" }]) },
      journalEntry: { create: journalCreate, update: journalUpdate }, journalLine: { createMany: lineCreate }, auditEvent: { create: audit },
    };
    await expect(approveReimbursementClaim(transactionClient(tx) as never, actor, claim.id)).resolves.toEqual({ ok: true, journalEntryId: "journal-a" });
    const lines = lineCreate.mock.calls[0][0].data;
    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ ledgerAccountId: "supplies-a", debitAmount: claim.expenses[0].amount, creditAmount: "0" }),
      expect.objectContaining({ ledgerAccountId: "payable-a", debitAmount: "0", creditAmount: claim.totalAmount }),
    ]));
    expect(JSON.stringify(lines)).not.toContain("PAYROLL");
    expect(JSON.stringify(lines)).not.toContain("DISTRIBUTION");
    expect(journalCreate.mock.calls[0][0].data.sourceType).toBe("REIMBURSEMENT_CLAIM");
    expect(claimUpdate.mock.calls[0][0].data.status).toBe("APPROVED");
  });

  it("settles an exact approved claim from tenant-scoped company-bank evidence once and prevents a concurrent duplicate", async () => {
    const claim = { id: "claim-a", totalAmount: decimal("48.21") };
    const external = { id: "external-a", amount: decimal("48.21"), financialAccountId: "cash-account-a", transactionDate: new Date("2026-08-09T12:00:00.000Z"), description: "Fictional reimbursement", normalizedMerchant: "Fictional", direction: "OUTFLOW", externalTransactionId: "safe-ref", financialAccount: { ledgerAccount: { id: "cash-ledger-a" } } };
    const createTransaction = vi.fn().mockResolvedValue({ id: "transaction-a" });
    const claimFind = vi.fn().mockResolvedValue(claim);
    const claimedExternal = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      reimbursementClaim: { findFirst: claimFind, update: claimUpdate },
      externalTransaction: { findFirst: vi.fn().mockResolvedValue(external), updateMany: claimedExternal },
      ledgerAccount: { findFirst: vi.fn().mockResolvedValue({ id: "payable-a" }) }, accountingPeriod: { findFirst: vi.fn().mockResolvedValue({ id: "period-a" }) }, transaction: { create: createTransaction }, journalEntry: { create: journalCreate, update: journalUpdate }, journalLine: { createMany: lineCreate }, auditEvent: { create: audit },
    };
    await expect(matchReimbursementPayment(transactionClient(tx) as never, actor, { claimId: claim.id, externalTransactionId: external.id })).resolves.toEqual({ ok: true, journalEntryId: "journal-a" });
    const lines = lineCreate.mock.calls[0][0].data;
    expect(lines).toEqual(expect.arrayContaining([expect.objectContaining({ ledgerAccountId: "payable-a", debitAmount: claim.totalAmount, creditAmount: "0" }), expect.objectContaining({ ledgerAccountId: "cash-ledger-a", debitAmount: "0", creditAmount: claim.totalAmount })]));
    expect(journalCreate.mock.calls[0][0].data.sourceType).toBe("REIMBURSEMENT_PAYMENT");
    expect(claimedExternal.mock.calls[0][0].where).toMatchObject({ businessId: actor.businessId, postedTransactionId: null });
    expect(claimUpdate.mock.calls[0][0].data).toMatchObject({ status: "PAID", paymentTransactionId: "transaction-a" });

    claimedExternal.mockResolvedValueOnce({ count: 0 });
    await expect(matchReimbursementPayment(transactionClient(tx) as never, actor, { claimId: claim.id, externalTransactionId: external.id })).resolves.toMatchObject({ ok: false });
  });
});

describe("payroll reversal", () => {
  it("creates opposite lines, retains the original, and prevents a second reversal", async () => {
    const original = { id: "journal-original", reversedAt: null, lines: [{ ledgerAccountId: "expense-a", debitAmount: decimal("100.00"), creditAmount: decimal("0.00") }, { ledgerAccountId: "cash-a", debitAmount: decimal("0.00"), creditAmount: decimal("100.00") }], reversedByEntries: [] };
    const run = { id: "payroll-a", payDate: new Date("2026-08-08T12:00:00.000Z"), journalEntry: original };
    const create = vi.fn().mockResolvedValue({ id: "journal-reversal" });
    const lines = vi.fn().mockResolvedValue({ count: 2 });
    const updateEntry = vi.fn().mockResolvedValue({ id: "entry" });
    const updateRun = vi.fn().mockResolvedValue({ id: run.id });
    const tx = { payrollRun: { findFirst: vi.fn().mockResolvedValue(run), update: updateRun }, accountingPeriod: { findFirst: vi.fn().mockResolvedValue({ id: "period-a" }) }, journalEntry: { create, update: updateEntry }, journalLine: { createMany: lines }, auditEvent: { create: vi.fn().mockResolvedValue({ id: "audit-a" }) } };
    await expect(reversePayrollRun(transactionClient(tx) as never, actor, { payrollRunId: run.id, reversalDate: "2026-08-09", confirmation: "on" })).resolves.toEqual({ ok: true, journalEntryId: "journal-reversal" });
    expect(lines.mock.calls[0][0].data).toEqual(expect.arrayContaining([expect.objectContaining({ ledgerAccountId: "expense-a", debitAmount: decimal("0.00"), creditAmount: decimal("100.00") }), expect.objectContaining({ ledgerAccountId: "cash-a", debitAmount: decimal("100.00"), creditAmount: decimal("0.00") })]));
    expect(updateEntry.mock.calls[0][0].where.id).toBe("journal-reversal");
    expect(updateEntry.mock.calls[1][0].where.id).toBe(original.id);
    expect(updateRun.mock.calls[0][0].data.status).toBe("VOIDED");

    tx.payrollRun.findFirst.mockResolvedValueOnce({ ...run, journalEntry: { ...original, reversedByEntries: [{ id: "already-reversed" }] } });
    await expect(reversePayrollRun(transactionClient(tx) as never, actor, { payrollRunId: run.id, reversalDate: "2026-08-09", confirmation: "on" })).resolves.toMatchObject({ ok: false });
  });
});
