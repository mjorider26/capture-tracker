import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/lib/database/create-prisma-client";

config({ path: ".env.test.local", override: false });

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");

const prisma = createPrismaClient(connectionString);
const lockId = `production-bootstrap-lock-${randomUUID()}`;

describe("production first-owner bootstrap database lock", () => {
  afterAll(async () => { await prisma.productionBootstrap.deleteMany({ where: { id: lockId } }); await prisma.$disconnect(); });

  it("allows exactly one concurrent singleton lease", async () => {
    const attempts = await Promise.allSettled([
      prisma.productionBootstrap.create({ data: { id: lockId, ownerEmailHash: "a".repeat(64) } }),
      prisma.productionBootstrap.create({ data: { id: lockId, ownerEmailHash: "b".repeat(64) } }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    await expect(prisma.productionBootstrap.count({ where: { id: lockId } })).resolves.toBe(1);
  });
});
