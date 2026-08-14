import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString)
  throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
process.env.DATABASE_URL = connectionString;

const { createPrismaClient } =
  await import("../../src/lib/database/create-prisma-client");
const { finalizeReconciliation } =
  await import("../../src/lib/services/reconciliation");

const prisma = createPrismaClient(connectionString);
const suffix = randomUUID();
const ids = {
  user: `onboarding-user-${suffix}`,
  business: `onboarding-business-${suffix}`,
  checking: `onboarding-checking-${suffix}`,
  card: `onboarding-card-${suffix}`,
  checkingReconciliation: `onboarding-checking-reconciliation-${suffix}`,
  cardReconciliation: `onboarding-card-reconciliation-${suffix}`,
};

const actor = {
  businessId: ids.business,
  actorUserId: ids.user,
  actorMembershipId: ids.user,
  role: "OWNER" as const,
  executionMode: "authenticated" as const,
};

describe("customer onboarding multi-account reconciliation", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: ids.user,
        email: `${suffix}@example.test`,
        displayName: "Fictional Onboarding Owner",
      },
    });
    await prisma.business.create({
      data: {
        id: ids.business,
        legalName: "Fictional Multi Account LLC",
        displayName: "Fictional Multi Account",
        members: { create: { userId: ids.user, role: "OWNER" } },
        onboarding: {
          create: {
            actorUserId: ids.user,
            ownerDisplayName: "Fictional Owner",
            cutoverDate: new Date("2026-01-01T12:00:00.000Z"),
            phase: "RECONCILIATION_REQUIRED",
          },
        },
        accounts: {
          create: [
            {
              id: ids.checking,
              name: "Fictional Checking",
              type: "CHECKING",
              ownership: "BUSINESS",
              openingBalance: "0.00",
            },
            {
              id: ids.card,
              name: "Fictional Card",
              type: "CREDIT_CARD",
              ownership: "BUSINESS",
              openingBalance: "0.00",
            },
          ],
        },
      },
    });
    await prisma.reconciliation.createMany({
      data: [
        {
          id: ids.checkingReconciliation,
          businessId: ids.business,
          financialAccountId: ids.checking,
          statementStartDate: new Date("2026-01-01T12:00:00.000Z"),
          statementEndDate: new Date("2026-01-31T12:00:00.000Z"),
          statementOpeningBalance: "0.00",
          statementEndingBalance: "0.00",
        },
        {
          id: ids.cardReconciliation,
          businessId: ids.business,
          financialAccountId: ids.card,
          statementStartDate: new Date("2026-01-01T12:00:00.000Z"),
          statementEndDate: new Date("2026-01-31T12:00:00.000Z"),
          statementOpeningBalance: "0.00",
          statementEndingBalance: "0.00",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.reconciliationItem.deleteMany({
      where: { businessId: ids.business },
    });
    await prisma.reconciliation.deleteMany({
      where: { businessId: ids.business },
    });
    await prisma.auditEvent.deleteMany({ where: { businessId: ids.business } });
    await prisma.businessOnboarding.deleteMany({
      where: { businessId: ids.business },
    });
    await prisma.financialAccount.deleteMany({
      where: { businessId: ids.business },
    });
    await prisma.businessMember.deleteMany({
      where: { businessId: ids.business },
    });
    await prisma.business.deleteMany({ where: { id: ids.business } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await prisma.$disconnect();
  });

  it("unlocks only after every account reconciles and remains idempotent", async () => {
    const first = await finalizeReconciliation(prisma, actor, {
      reconciliationId: ids.checkingReconciliation,
      expectedVersion: "1",
    });
    expect(first).toMatchObject({ ok: true, status: "COMPLETED" });
    await expect(
      prisma.businessOnboarding.findUniqueOrThrow({
        where: { businessId: ids.business },
        select: {
          phase: true,
          status: true,
          initialReconciliationComplete: true,
          booksCurrentThrough: true,
        },
      }),
    ).resolves.toEqual({
      phase: "RECONCILIATION_REQUIRED",
      status: "IN_PROGRESS",
      initialReconciliationComplete: false,
      booksCurrentThrough: null,
    });

    const second = await finalizeReconciliation(prisma, actor, {
      reconciliationId: ids.cardReconciliation,
      expectedVersion: "1",
    });
    expect(second).toMatchObject({ ok: true, status: "COMPLETED" });
    await expect(
      prisma.businessOnboarding.findUniqueOrThrow({
        where: { businessId: ids.business },
        select: {
          phase: true,
          initialReconciliationComplete: true,
          booksCurrentThrough: true,
        },
      }),
    ).resolves.toEqual({
      phase: "READINESS_CHECK",
      initialReconciliationComplete: true,
      booksCurrentThrough: new Date("2026-01-31T12:00:00.000Z"),
    });

    const auditCount = await prisma.auditEvent.count({
      where: { businessId: ids.business, entityType: "Reconciliation" },
    });
    const journalCount = await prisma.journalEntry.count({
      where: { businessId: ids.business },
    });
    const retry = await finalizeReconciliation(prisma, actor, {
      reconciliationId: ids.cardReconciliation,
      expectedVersion: "1",
    });
    expect(retry).toMatchObject({ ok: false, code: "IMMUTABLE" });
    await expect(
      prisma.auditEvent.count({
        where: { businessId: ids.business, entityType: "Reconciliation" },
      }),
    ).resolves.toBe(auditCount);
    await expect(
      prisma.journalEntry.count({ where: { businessId: ids.business } }),
    ).resolves.toBe(journalCount);
  });
});
