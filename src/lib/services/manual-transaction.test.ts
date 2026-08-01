import { describe, expect, it, vi } from "vitest";

import { Prisma } from "../../generated/prisma/client";
import { createManualTransaction } from "./manual-transaction";

const actor = { businessId: "business_a", actorUserId: "user_a", actorMembershipId: "membership_a", role: "OWNER" as const, executionMode: "authenticated" as const };
const base = { transactionType: "INCOME", transactionDate: "2026-08-01", amount: "125.10", merchantOrPayer: "Example payer", description: "Manual income", financialAccountId: "checking_a", categoryAccountId: "income_a", idempotencyKey: "123e4567-e89b-42d3-a456-426614174001" };

function memoryClient({ openPeriod = true, accountBusinessId = "business_a" }: { openPeriod?: boolean; accountBusinessId?: string } = {}) {
  const transactions: Array<Record<string, unknown>> = [];
  const journals: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  let sequence = 0;
  const client: Record<string, unknown> = {
    transaction: {
      findFirst: vi.fn(async ({ where }: { where: { businessId: string; manualEntryKey: string } }) => {
        const found = transactions.find((item) => item.businessId === where.businessId && item.manualEntryKey === where.manualEntryKey);
        if (!found) return null;
        const journal = journals.find((item) => item.transactionId === found.id);
        return { ...found, journalEntry: journal ? { id: journal.id } : null };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `transaction_${++sequence}`, amount: new Prisma.Decimal(data.amount as string), postedAt: data.postedAt as Date };
        transactions.push(row);
        return row;
      }),
    },
    financialAccount: { findFirst: vi.fn(async ({ where }: { where: { businessId: string } }) => where.businessId === accountBusinessId ? { id: "checking_a", ledgerAccount: { id: "cash_a", type: "ASSET", isActive: true } } : null) },
    accountingPeriod: { findFirst: vi.fn(async () => openPeriod ? { id: "period_a" } : null) },
    ledgerAccount: {
      findFirst: vi.fn(async () => ({ id: "income_a" })),
      findMany: vi.fn(async () => [{ id: "contributions_a", subtype: "OWNER_CONTRIBUTION" }, { id: "distributions_a", subtype: "OWNER_DISTRIBUTION" }]),
    },
    transactionSplit: { createMany: vi.fn(async () => ({ count: 2 })) },
    journalEntry: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `journal_${++sequence}` }; journals.push(row); return row; }),
      update: vi.fn(async () => ({})),
    },
    journalLine: { createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => { lines.push(...data); return { count: data.length }; }) },
    auditEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { audits.push(data); return data; }) },
  };
  client.$transaction = async (callback: (tx: typeof client) => unknown) => callback(client);
  return { client, transactions, journals, lines, audits };
}

describe("manual transaction service", () => {
  it("persists a balanced income transaction, journal relationship, and immutable audit event", async () => {
    const store = memoryClient();
    const result = await createManualTransaction(store.client as never, actor, base);
    expect(result).toMatchObject({ ok: true, code: "CREATED" });
    expect(store.transactions).toHaveLength(1);
    expect(store.journals).toHaveLength(1);
    expect(store.audits).toHaveLength(1);
    const debit = store.lines.reduce((sum, line) => sum.plus(line.debitAmount as string), new Prisma.Decimal(0));
    const credit = store.lines.reduce((sum, line) => sum.plus(line.creditAmount as string), new Prisma.Decimal(0));
    expect(debit.equals(credit)).toBe(true);
  });

  it("returns the existing source transaction for a duplicate intent key", async () => {
    const store = memoryClient();
    const first = await createManualTransaction(store.client as never, actor, base);
    const second = await createManualTransaction(store.client as never, actor, base);
    expect(first.ok && second.ok && second.code).toBe("ALREADY_CREATED");
    expect(store.transactions).toHaveLength(1);
  });

  it("denies non-owners, closed periods, and a cash account outside the active business", async () => {
    const nonOwner = await createManualTransaction(memoryClient().client as never, { ...actor, role: "ADVISOR" }, base);
    expect(nonOwner).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const closed = await createManualTransaction(memoryClient({ openPeriod: false }).client as never, actor, base);
    expect(closed).toMatchObject({ ok: false, code: "NO_OPEN_PERIOD" });
    const otherBusiness = await createManualTransaction(memoryClient({ accountBusinessId: "business_b" }).client as never, actor, base);
    expect(otherBusiness).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
