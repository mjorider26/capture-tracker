import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import { reviewTransaction } from "../../src/lib/services/review-transaction-core";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString)
  throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  owner: `review-owner-${run}`,
  advisor: `review-advisor-${run}`,
  businessA: `review-business-a-${run}`,
  businessB: `review-business-b-${run}`,
  accountA: `review-account-a-${run}`,
  accountB: `review-account-b-${run}`,
};
const actor = {
  businessId: ids.businessA,
  actorUserId: ids.owner,
  actorMembershipId: `review-member-owner-${run}`,
  role: "OWNER" as const,
  executionMode: "authenticated" as const,
};

async function createPending(id: string, amount = "150.00") {
  await prisma.transaction.create({
    data: {
      id,
      businessId: ids.businessA,
      accountId: ids.accountA,
      postedAt: new Date("2026-07-20T12:00:00.000Z"),
      description: "Review fixture",
      amount,
      direction: "OUTFLOW",
      sourceReference: `review-source-${id}`,
    },
  });
}

describe("secure transaction review", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: ids.owner,
          email: `owner-${run}@capturetracker.local`,
          displayName: "Owner",
          emailVerified: true,
        },
        {
          id: ids.advisor,
          email: `advisor-${run}@capturetracker.local`,
          displayName: "Advisor",
          emailVerified: true,
        },
      ],
    });
    await prisma.business.createMany({
      data: [
        {
          id: ids.businessA,
          legalName: "Review A LLC",
          displayName: "Review A",
        },
        {
          id: ids.businessB,
          legalName: "Review B LLC",
          displayName: "Review B",
        },
      ],
    });
    await prisma.businessMember.createMany({
      data: [
        {
          id: actor.actorMembershipId,
          businessId: ids.businessA,
          userId: ids.owner,
          role: "OWNER",
        },
        {
          id: `review-member-advisor-${run}`,
          businessId: ids.businessA,
          userId: ids.advisor,
          role: "ADVISOR",
        },
      ],
    });
    await prisma.financialAccount.createMany({
      data: [
        {
          id: ids.accountA,
          businessId: ids.businessA,
          name: "A checking",
          type: "CHECKING",
          ownership: "BUSINESS",
          openingBalance: "0.00",
        },
        {
          id: ids.accountB,
          businessId: ids.businessB,
          name: "B checking",
          type: "CHECKING",
          ownership: "BUSINESS",
          openingBalance: "0.00",
        },
      ],
    });
  });
  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: { businessId: { in: [ids.businessA, ids.businessB] } },
    });
    await prisma.transactionSplit.deleteMany({
      where: { businessId: { in: [ids.businessA, ids.businessB] } },
    });
    await prisma.transaction.deleteMany({
      where: { businessId: { in: [ids.businessA, ids.businessB] } },
    });
    await prisma.financialAccount.deleteMany({
      where: { id: { in: [ids.accountA, ids.accountB] } },
    });
    await prisma.businessMember.deleteMany({
      where: { businessId: ids.businessA },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.owner, ids.advisor] } },
    });
    await prisma.business.deleteMany({
      where: { id: { in: [ids.businessA, ids.businessB] } },
    });
    await prisma.$disconnect();
  });

  it("reviews own business transactions atomically and audits once", async () => {
    const id = `review-business-${run}`;
    await createPending(id);
    const result = await reviewTransaction(prisma, actor, {
      transactionId: id,
      expectedVersion: "1",
      intent: "BUSINESS",
      splits: [],
    });
    expect(result).toMatchObject({ ok: true, nextVersion: 2 });
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { splits: true },
    });
    expect(transaction).toMatchObject({
      intent: "BUSINESS",
      status: "APPROVED",
      version: 2,
    });
    expect(transaction?.splits).toHaveLength(0);
    expect(
      await prisma.auditEvent.count({
        where: { businessId: ids.businessA, entityId: id },
      }),
    ).toBe(1);
  });
  it("reviews personal activity and rejects invalid mixed totals without audit evidence", async () => {
    const personal = `review-personal-${run}`;
    await createPending(personal);
    expect(
      await reviewTransaction(prisma, actor, {
        transactionId: personal,
        expectedVersion: "1",
        intent: "PERSONAL",
        splits: [],
      }),
    ).toMatchObject({ ok: true });
    expect(
      await prisma.transaction.findUnique({ where: { id: personal } }),
    ).toMatchObject({ intent: "PERSONAL", status: "EXCLUDED" });
    const invalid = `review-invalid-${run}`;
    await createPending(invalid);
    expect(
      await reviewTransaction(prisma, actor, {
        transactionId: invalid,
        expectedVersion: "1",
        intent: "MIXED",
        splits: [
          { intent: "BUSINESS", amount: "149.99" },
          { intent: "PERSONAL", amount: "0.00" },
        ],
      }),
    ).toMatchObject({ ok: false, code: "INVALID" });
    expect(
      await prisma.auditEvent.count({ where: { entityId: invalid } }),
    ).toBe(0);
  });
  it("rejects foreign, stale, future-version, and advisor review requests", async () => {
    const foreign = `review-foreign-${run}`;
    await prisma.transaction.create({
      data: {
        id: foreign,
        businessId: ids.businessB,
        accountId: ids.accountB,
        postedAt: new Date(),
        description: "Foreign",
        amount: "5.00",
        direction: "OUTFLOW",
        sourceReference: `foreign-${run}`,
      },
    });
    expect(
      await reviewTransaction(prisma, actor, {
        transactionId: foreign,
        expectedVersion: "1",
        intent: "BUSINESS",
        splits: [],
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const id = `review-concurrency-${run}`;
    await createPending(id);
    await reviewTransaction(prisma, actor, {
      transactionId: id,
      expectedVersion: "1",
      intent: "PERSONAL",
      splits: [],
    });
    expect(
      await reviewTransaction(prisma, actor, {
        transactionId: id,
        expectedVersion: "1",
        intent: "BUSINESS",
        splits: [],
      }),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
    const future = `review-future-${run}`;
    await createPending(future);
    expect(
      await reviewTransaction(prisma, actor, {
        transactionId: future,
        expectedVersion: "99",
        intent: "BUSINESS",
        splits: [],
      }),
    ).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(
      await reviewTransaction(
        prisma,
        { ...actor, actorUserId: ids.advisor, role: "ADVISOR" },
        {
          transactionId: future,
          expectedVersion: "1",
          intent: "BUSINESS",
          splits: [],
        },
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
