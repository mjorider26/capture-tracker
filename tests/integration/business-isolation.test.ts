import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import { findTransactionForBusiness } from "../../src/lib/data/transaction-access-core";

config({
  path: ".env.test.local",
  override: false,
});

const connectionString = process.env.TEST_DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
}

const prisma = createPrismaClient(connectionString);

const testRunId = randomUUID();

const ids = {
  user: `integration-user-${testRunId}`,

  businessA: `integration-business-a-${testRunId}`,
  businessB: `integration-business-b-${testRunId}`,

  membershipA: `integration-membership-a-${testRunId}`,

  accountA: `integration-account-a-${testRunId}`,
  accountB: `integration-account-b-${testRunId}`,

  transactionA: `integration-transaction-a-${testRunId}`,
  transactionB: `integration-transaction-b-${testRunId}`,
};

describe("business transaction isolation", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: ids.user,
        email: `integration-${testRunId}@capturetracker.local`,
        displayName: "Integration Test Owner",
        emailVerified: true,
      },
    });

    await prisma.business.createMany({
      data: [
        {
          id: ids.businessA,
          legalName: "Integration Company A LLC",
          displayName: "Integration Company A",
        },
        {
          id: ids.businessB,
          legalName: "Integration Company B LLC",
          displayName: "Integration Company B",
        },
      ],
    });

    await prisma.businessMember.create({
      data: {
        id: ids.membershipA,
        userId: ids.user,
        businessId: ids.businessA,
        role: "OWNER",
      },
    });

    await prisma.financialAccount.createMany({
      data: [
        {
          id: ids.accountA,
          businessId: ids.businessA,
          name: "Company A Checking",
          type: "CHECKING",
          ownership: "BUSINESS",
          openingBalance: "0.00",
        },
        {
          id: ids.accountB,
          businessId: ids.businessB,
          name: "Company B Checking",
          type: "CHECKING",
          ownership: "BUSINESS",
          openingBalance: "0.00",
        },
      ],
    });

    await prisma.transaction.createMany({
      data: [
        {
          id: ids.transactionA,
          businessId: ids.businessA,
          accountId: ids.accountA,
          postedAt: new Date("2026-07-01T12:00:00.000Z"),
          description: "Company A commission",
          amount: "1250.00",
          direction: "INFLOW",
          sourceReference: `source-a-${testRunId}`,
        },
        {
          id: ids.transactionB,
          businessId: ids.businessB,
          accountId: ids.accountB,
          postedAt: new Date("2026-07-02T12:00:00.000Z"),
          description: "Company B commission",
          amount: "2400.00",
          direction: "INFLOW",
          sourceReference: `source-b-${testRunId}`,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: {
        id: {
          in: [ids.transactionA, ids.transactionB],
        },
      },
    });

    await prisma.financialAccount.deleteMany({
      where: {
        id: {
          in: [ids.accountA, ids.accountB],
        },
      },
    });

    await prisma.businessMember.deleteMany({
      where: {
        id: ids.membershipA,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: ids.user,
      },
    });

    await prisma.business.deleteMany({
      where: {
        id: {
          in: [ids.businessA, ids.businessB],
        },
      },
    });

    await prisma.$disconnect();
  });

  it("returns a transaction belonging to the scoped business", async () => {
    const transaction = await findTransactionForBusiness(prisma, {
      businessId: ids.businessA,
      transactionId: ids.transactionA,
    });

    expect(transaction).toMatchObject({
      id: ids.transactionA,
      businessId: ids.businessA,
      accountId: ids.accountA,
      description: "Company A commission",
    });
  });

  it("does not return another business's transaction", async () => {
    const transaction = await findTransactionForBusiness(prisma, {
      businessId: ids.businessA,
      transactionId: ids.transactionB,
    });

    expect(transaction).toBeNull();
  });

  it("rejects a cross-business account relationship", async () => {
    await expect(
      prisma.transaction.create({
        data: {
          businessId: ids.businessA,
          accountId: ids.accountB,
          postedAt: new Date("2026-07-03T12:00:00.000Z"),
          description: "Invalid cross-business transaction",
          amount: "99.00",
          direction: "OUTFLOW",
          sourceReference: `invalid-${testRunId}`,
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects a cross-business transaction split relationship", async () => {
    await expect(
      prisma.transactionSplit.create({
        data: {
          id: `invalid-split-${testRunId}`,
          businessId: ids.businessA,
          transactionId: ids.transactionB,
          intent: "BUSINESS",
          amount: "1.00",
        },
      }),
    ).rejects.toThrow();
  });
});
