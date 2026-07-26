import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  user: `document-user-${run}`,
  businessA: `document-business-a-${run}`,
  businessB: `document-business-b-${run}`,
};

function activeDocument(businessId: string, sha256: string, suffix: string) {
  return {
    id: `document-${suffix}-${run}`,
    businessId,
    uploadedByMembershipId: ids.user,
    storageKey: `object-${suffix}-${run}`,
    originalFilename: "fictional.pdf",
    displayName: "Fictional document",
    mimeType: "application/pdf",
    sizeBytes: BigInt(16),
    storedSizeBytes: BigInt(16),
    sha256,
    type: "OTHER" as const,
    category: "OTHER" as const,
    status: "ACTIVE" as const,
    storageState: "STORED_PRIVATE" as const,
    storageProvider: "LOCAL_FICTIONAL",
    malwareScanStatus: "CLEAN" as const,
    malwareScannedAt: new Date(),
    retentionClass: "GENERAL_TAX_SEVEN_YEARS" as const,
    retentionUntil: new Date("2033-07-02T00:00:00.000Z"),
    privateReadEligible: true,
  };
}

describe("document storage PostgreSQL integrity", () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: ids.user, email: `document-${run}@capturetracker.local`, displayName: "Document fixture", emailVerified: true } });
    await prisma.business.createMany({ data: [
      { id: ids.businessA, legalName: "Document A LLC", displayName: "Document A" },
      { id: ids.businessB, legalName: "Document B LLC", displayName: "Document B" },
    ] });
    await prisma.businessMember.createMany({ data: [
      { id: `document-member-a-${run}`, businessId: ids.businessA, userId: ids.user, role: "OWNER" },
      { id: `document-member-b-${run}`, businessId: ids.businessB, userId: ids.user, role: "OWNER" },
    ] });
  });

  afterAll(async () => {
    await prisma.documentStatusHistory.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.document.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.business.deleteMany({ where: { id: { in: [ids.businessA, ids.businessB] } } });
    await prisma.user.delete({ where: { id: ids.user } });
    await prisma.$disconnect();
  });

  it("uses the database constraint as the concurrent same-business duplicate authority", async () => {
    const hash = "e".repeat(64);
    const attempts = await Promise.allSettled([
      prisma.document.create({ data: activeDocument(ids.businessA, hash, "first") }),
      prisma.document.create({ data: activeDocument(ids.businessA, hash, "second") }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.document.count({ where: { businessId: ids.businessA, sha256: hash } })).toBe(1);
  });

  it("permits the same fictional bytes in another business and hides cross-business records", async () => {
    const hash = "f".repeat(64);
    const document = await prisma.document.create({ data: activeDocument(ids.businessB, hash, "other-business") });
    expect(await prisma.document.findFirst({ where: { id: document.id, businessId: ids.businessA } })).toBeNull();
  });

  it("rejects an active record without a clean private read state", async () => {
    await expect(prisma.document.create({ data: { ...activeDocument(ids.businessA, "1".repeat(64), "invalid"), privateReadEligible: false } })).rejects.toThrow();
  });

  it("rejects a quarantined record that claims a clean scan", async () => {
    await expect(prisma.document.create({ data: { ...activeDocument(ids.businessA, "2".repeat(64), "invalid-quarantine"), status: "QUARANTINED", storageState: "QUARANTINED_PRIVATE", privateReadEligible: false, malwareScanStatus: "CLEAN", quarantineReasonCode: "SYNTHETIC" } })).rejects.toThrow();
  });
});
