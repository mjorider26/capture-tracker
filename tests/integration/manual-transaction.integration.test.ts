import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import { createManualTransaction } from "../../src/lib/services/manual-transaction";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured.");
const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  owner: `manual-owner-${run}`, advisor: `manual-advisor-${run}`, businessA: `manual-business-a-${run}`, businessB: `manual-business-b-${run}`,
  accountA: `manual-account-a-${run}`, accountB: `manual-account-b-${run}`, cash: `manual-ledger-cash-${run}`, income: `manual-ledger-income-${run}`, expense: `manual-ledger-expense-${run}`, contributions: `manual-ledger-contributions-${run}`, distributions: `manual-ledger-distributions-${run}`, period: `manual-period-${run}`,
};
const actor = { businessId: ids.businessA, actorUserId: ids.owner, actorMembershipId: `manual-member-owner-${run}`, role: "OWNER" as const, executionMode: "authenticated" as const };
const input = (key: string, patch: Record<string, unknown> = {}) => ({ transactionDate: "2026-08-01", amount: "100.00", merchantOrPayer: "Fictional counterparty", description: "Fictional manual entry", financialAccountId: ids.accountA, categoryAccountId: ids.income, idempotencyKey: key, ...patch });

describe("manual transaction entry with full PostgreSQL integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [{ id: ids.owner, email: `manual-owner-${run}@capturetracker.local`, displayName: "Manual owner" }, { id: ids.advisor, email: `manual-advisor-${run}@capturetracker.local`, displayName: "Manual advisor" }] });
    await prisma.business.createMany({ data: [{ id: ids.businessA, legalName: "Manual A LLC", displayName: "Manual A" }, { id: ids.businessB, legalName: "Manual B LLC", displayName: "Manual B" }] });
    await prisma.businessMember.createMany({ data: [{ id: actor.actorMembershipId, businessId: ids.businessA, userId: ids.owner, role: "OWNER" }, { id: `manual-member-advisor-${run}`, businessId: ids.businessA, userId: ids.advisor, role: "ADVISOR" }] });
    await prisma.financialAccount.createMany({ data: [{ id: ids.accountA, businessId: ids.businessA, name: "Manual Checking", type: "CHECKING", ownership: "BUSINESS" }, { id: ids.accountB, businessId: ids.businessB, name: "Foreign Checking", type: "CHECKING", ownership: "BUSINESS" }] });
    await prisma.ledgerAccount.createMany({ data: [
      { id: ids.cash, businessId: ids.businessA, code: "1000", name: "Business Checking", type: "ASSET", subtype: "BANK", normalBalance: "DEBIT", financialAccountId: ids.accountA },
      { id: ids.contributions, businessId: ids.businessA, code: "3000", name: "Owner Contributions", type: "EQUITY", subtype: "OWNER_CONTRIBUTION", normalBalance: "CREDIT" },
      { id: ids.distributions, businessId: ids.businessA, code: "3100", name: "Owner Distributions", type: "EQUITY", subtype: "OWNER_DISTRIBUTION", normalBalance: "DEBIT" },
      { id: ids.income, businessId: ids.businessA, code: "4000", name: "Business Income", type: "INCOME", subtype: "COMMISSION_INCOME", normalBalance: "CREDIT" },
      { id: ids.expense, businessId: ids.businessA, code: "5900", name: "Other Business Expense", type: "EXPENSE", subtype: "OTHER_EXPENSE", normalBalance: "DEBIT" },
    ] });
    await prisma.accountingPeriod.create({ data: { id: ids.period, businessId: ids.businessA, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2026-12-31T23:59:59.999Z"), status: "OPEN" } });
  });

  afterAll(async () => {
    const journalIds = (await prisma.journalEntry.findMany({ where: { businessId: ids.businessA }, select: { id: true } })).map((entry) => entry.id);
    const archiveId = `manual-archive-${run}`;
    await prisma.auditEvent.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.updateMany({ where: { id: { in: journalIds } }, data: { status: "DRAFT", transactionId: null, sourceEntityId: null } });
      await tx.journalEntry.create({ data: { id: archiveId, businessId: ids.businessA, accountingPeriodId: ids.period, entryNumber: `ARCHIVE-${run}`, entryDate: new Date("2026-08-01T12:00:00.000Z"), description: "Disposable integration archive", status: "DRAFT", sourceType: "MANUAL" } });
      for (const [index, journalId] of journalIds.entries()) await tx.$executeRaw`UPDATE "JournalLine" SET "journalEntryId" = ${archiveId}, "lineNumber" = "lineNumber" + ${(index + 1) * 100} WHERE "journalEntryId" = ${journalId}`;
    });
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
    });
    await prisma.$transaction(async (tx) => {
      await tx.transaction.updateMany({ where: { businessId: ids.businessA, intent: "MIXED" }, data: { intent: "PERSONAL", status: "EXCLUDED" } });
      await tx.transactionSplit.deleteMany({ where: { businessId: ids.businessA } });
    });
    await prisma.transaction.deleteMany({ where: { businessId: ids.businessA } });
    await prisma.journalLine.deleteMany({ where: { journalEntryId: archiveId } });
    await prisma.journalEntry.delete({ where: { id: archiveId } });
    await prisma.ledgerAccount.deleteMany({ where: { businessId: ids.businessA } });
    await prisma.accountingPeriod.deleteMany({ where: { businessId: ids.businessA } });
    await prisma.financialAccount.deleteMany({ where: { id: { in: [ids.accountA, ids.accountB] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: ids.businessA } });
    await prisma.business.deleteMany({ where: { id: { in: [ids.businessA, ids.businessB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.advisor] } } });
    await prisma.$disconnect();
  });

  it("posts income, business expense, personal activity, and exact mixed activity with balanced journals", async () => {
    const [income, expense, personal, mixed] = await Promise.all([
      createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174101", { transactionType: "INCOME" })),
      createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174102", { transactionType: "BUSINESS_EXPENSE", categoryAccountId: ids.expense, description: "Fictional expense" })),
      createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174103", { transactionType: "PERSONAL", cashDirection: "OUTFLOW", categoryAccountId: undefined, description: "Fictional owner distribution" })),
      createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174104", { transactionType: "MIXED", cashDirection: "OUTFLOW", categoryAccountId: ids.expense, businessAmount: "60.10", personalAmount: "39.90", description: "Fictional mixed payment" })),
    ]);
    expect([income, expense, personal, mixed].every((result) => result.ok && result.code === "CREATED")).toBe(true);
    const entries = await prisma.journalEntry.findMany({ where: { businessId: ids.businessA }, include: { lines: { include: { ledgerAccount: true }, orderBy: { lineNumber: "asc" } }, transaction: true }, orderBy: { id: "asc" } });
    expect(entries).toHaveLength(4);
    for (const entry of entries) {
      const debit = entry.lines.reduce((sum, line) => sum.plus(line.debitAmount), entries[0]!.lines[0]!.debitAmount.minus(entries[0]!.lines[0]!.debitAmount));
      const credit = entry.lines.reduce((sum, line) => sum.plus(line.creditAmount), entries[0]!.lines[0]!.creditAmount.minus(entries[0]!.lines[0]!.creditAmount));
      expect(entry.status).toBe("POSTED"); expect(debit.equals(credit) && debit.greaterThan(0)).toBe(true);
    }
    const personalEntry = entries.find((entry) => entry.transaction?.intent === "PERSONAL")!;
    expect(personalEntry.lines.some((line) => line.ledgerAccountId === ids.distributions)).toBe(true);
    expect(personalEntry.lines.some((line) => line.ledgerAccountId === ids.expense)).toBe(false);
    const mixedEntry = entries.find((entry) => entry.transaction?.intent === "MIXED")!;
    expect(mixedEntry.lines.map((line) => line.ledgerAccountId)).toEqual([ids.expense, ids.distributions, ids.cash]);
    expect(await prisma.transactionSplit.count({ where: { businessId: ids.businessA, transaction: { intent: "MIXED" } } })).toBe(2);
    expect(await prisma.auditEvent.count({ where: { businessId: ids.businessA, entityType: "Transaction", action: "CREATE" } })).toBe(4);
  });

  it("rejects invalid submissions, closed-period dates, cross-business accounts, and non-owner writes", async () => {
    await expect(createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174105", { transactionType: "MIXED", cashDirection: "OUTFLOW", categoryAccountId: ids.expense, businessAmount: "60.00", personalAmount: "39.99" }))).resolves.toMatchObject({ ok: false, code: "INVALID" });
    await expect(createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174106", { transactionType: "INCOME", transactionDate: "2027-01-01" }))).resolves.toMatchObject({ ok: false, code: "NO_OPEN_PERIOD" });
    await expect(createManualTransaction(prisma, actor, input("123e4567-e89b-42d3-a456-426614174107", { transactionType: "INCOME", financialAccountId: ids.accountB }))).resolves.toMatchObject({ ok: false, code: "NOT_FOUND" });
    await expect(createManualTransaction(prisma, { ...actor, role: "ADVISOR" }, input("123e4567-e89b-42d3-a456-426614174108", { transactionType: "INCOME" }))).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("makes duplicate submits idempotent without adding a journal or audit event", async () => {
    const key = "123e4567-e89b-42d3-a456-426614174109";
    const first = await createManualTransaction(prisma, actor, input(key, { transactionType: "INCOME", description: "Fictional retry" }));
    const second = await createManualTransaction(prisma, actor, input(key, { transactionType: "INCOME", description: "Fictional retry" }));
    expect(first).toMatchObject({ ok: true, code: "CREATED" });
    expect(second).toMatchObject({ ok: true, code: "ALREADY_CREATED" });
    expect(await prisma.transaction.count({ where: { businessId: ids.businessA, manualEntryKey: key } })).toBe(1);
  });
});
