import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import { assertTenantIdentity, productionAcceptance, reservedBusinessId } from "../../scripts/production-acceptance-cleanup-core";
import { deleteTenant, scopedCounts } from "../../scripts/cleanup-production-acceptance";

const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is required for production acceptance cleanup integration tests.");
const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  user: `acceptance-user-${run}`,
  business: "",
  account: `acceptance-account-${run}`,
  transaction: `acceptance-transaction-${run}`,
  document: `acceptance-document-${run}`,
  unrelatedUser: `acceptance-unrelated-user-${run}`,
  unrelatedBusiness: `acceptance-unrelated-business-${run}`,
};
ids.business = reservedBusinessId(ids.user);

async function target() {
  const user = await prisma.user.findUnique({ where: { email: productionAcceptance.email }, select: { id: true, email: true, displayName: true } });
  const business = user ? await prisma.business.findUnique({ where: { id: reservedBusinessId(user.id) }, select: { id: true, legalName: true, displayName: true } }) : null;
  const memberships = user ? await prisma.businessMember.findMany({ where: { userId: user.id }, select: { businessId: true } }) : [];
  return assertTenantIdentity({ user, business, memberships });
}

describe("production fictional acceptance cleanup PostgreSQL integration", () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: ids.user, email: productionAcceptance.email, displayName: productionAcceptance.displayName, emailVerified: true } });
    await prisma.business.create({ data: { id: ids.business, legalName: productionAcceptance.businessName, displayName: productionAcceptance.businessName } });
    await prisma.businessMember.create({ data: { businessId: ids.business, userId: ids.user, role: "OWNER" } });
    await prisma.financialAccount.create({ data: { id: ids.account, businessId: ids.business, name: "Fictional checking", type: "CHECKING", ownership: "BUSINESS" } });
    await prisma.transaction.create({ data: { id: ids.transaction, businessId: ids.business, accountId: ids.account, postedAt: new Date("2026-08-01T00:00:00.000Z"), description: "Fictional acceptance expense", amount: "12.00", direction: "OUTFLOW", intent: "MIXED", splits: { create: { intent: "BUSINESS", amount: "12.00" } } } });
    await prisma.document.create({ data: { id: ids.document, businessId: ids.business, uploadedByMembershipId: ids.user, storageKey: `${ids.business}/fictional-document`, originalFilename: "fictional.pdf", displayName: "Fictional acceptance document", mimeType: "application/pdf", sizeBytes: BigInt(16), storedSizeBytes: BigInt(16), sha256: "a".repeat(64), type: "OTHER", category: "OTHER", status: "ACTIVE", storageState: "STORED_PRIVATE", storageProvider: "LOCAL_FICTIONAL", malwareScanStatus: "CLEAN", malwareScannedAt: new Date(), privateReadEligible: true, retentionClass: "GENERAL_TAX_SEVEN_YEARS", retentionUntil: new Date("2033-08-01T00:00:00.000Z") } });
    await prisma.user.create({ data: { id: ids.unrelatedUser, email: `unrelated-${run}@capturetracker.invalid`, displayName: "Unrelated fictional owner", emailVerified: true } });
    await prisma.business.create({ data: { id: ids.unrelatedBusiness, legalName: "Unrelated Fictional LLC", displayName: "Unrelated Fictional" } });
    await prisma.businessMember.create({ data: { businessId: ids.unrelatedBusiness, userId: ids.unrelatedUser, role: "OWNER" } });
  });

  afterAll(async () => {
    await prisma.businessMember.deleteMany({ where: { businessId: ids.unrelatedBusiness } });
    await prisma.business.deleteMany({ where: { id: ids.unrelatedBusiness } });
    await prisma.user.deleteMany({ where: { id: ids.unrelatedUser } });
    await prisma.$disconnect();
  });

  it("keeps the target unchanged during a dry-run count", async () => {
    const resolved = await target();
    const counts = await scopedCounts(prisma, resolved.businessId);
    expect(counts.reduce((sum, item) => sum + item.count, 0)).toBeGreaterThanOrEqual(5);
    expect(await prisma.transaction.count({ where: { businessId: resolved.businessId } })).toBe(1);
  });

  it("aborts when the reserved account has an unrelated membership", async () => {
    await prisma.businessMember.create({ data: { businessId: ids.unrelatedBusiness, userId: ids.user, role: "ADVISOR" } });
    await expect(target()).rejects.toThrow("CROSS_TENANT_MEMBERSHIP_REFUSED");
    await prisma.businessMember.delete({ where: { businessId_userId: { businessId: ids.unrelatedBusiness, userId: ids.user } } });
  });

  it("deletes only the reserved fictional tenant and is safely non-repeatable", async () => {
    const resolved = await target();
    await deleteTenant(prisma, resolved.businessId, resolved.userId);
    expect(await prisma.user.count({ where: { id: resolved.userId } })).toBe(0);
    expect(await prisma.business.count({ where: { id: resolved.businessId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { businessId: resolved.businessId } })).toBe(0);
    expect(await prisma.document.count({ where: { businessId: resolved.businessId } })).toBe(0);
    expect(await prisma.business.count({ where: { id: ids.unrelatedBusiness } })).toBe(1);
    await expect(target()).rejects.toThrow("RESERVED_USER_REFUSED");
  });
});
