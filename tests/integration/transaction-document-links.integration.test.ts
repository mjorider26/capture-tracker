import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import {
  linkDocumentToTransactionCore as linkDocumentToTransaction,
  unlinkDocumentFromTransactionCore as unlinkDocumentFromTransaction,
} from "../../src/lib/documents/transaction-links-core";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
const prisma = createPrismaClient(connectionString);
const rollbackPrisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  user: `link-user-${run}`,
  businessA: `link-business-a-${run}`,
  businessB: `link-business-b-${run}`,
  accountA: `link-account-a-${run}`,
  accountB: `link-account-b-${run}`,
  transactionA: `link-transaction-a-${run}`,
  transactionB: `link-transaction-b-${run}`,
  cleanDocument: `link-document-clean-${run}`,
  cleanDocumentTwo: `link-document-clean-two-${run}`,
  pendingDocument: `link-document-pending-${run}`,
  otherDocument: `link-document-other-${run}`,
};
const actorA = { businessId: ids.businessA, actorUserId: ids.user };

function documentData(id: string, businessId: string, suffix: string, active = true) {
  return {
    id, businessId, uploadedByMembershipId: ids.user, storageKey: `link-object-${suffix}-${run}`,
    originalFilename: `fictional-${suffix}.pdf`, displayName: `Fictional ${suffix}`, mimeType: "application/pdf",
    sizeBytes: BigInt(32), storedSizeBytes: active ? BigInt(32) : null, sha256: suffix.repeat(64),
    type: "RECEIPT" as const, category: "RECEIPT" as const,
    status: active ? "ACTIVE" as const : "PENDING_VALIDATION" as const,
    storageState: active ? "STORED_PRIVATE" as const : "PENDING_STORAGE" as const,
    storageProvider: active ? "LOCAL_FICTIONAL" : null,
    malwareScanStatus: active ? "CLEAN" as const : "PENDING" as const,
    malwareScannedAt: active ? new Date() : null,
    retentionClass: "GENERAL_TAX_SEVEN_YEARS" as const, retentionUntil: new Date("2033-07-02T00:00:00.000Z"),
    privateReadEligible: active,
  };
}

describe("transaction document links PostgreSQL integrity", () => {
  beforeAll(async () => {
    await prisma.user.create({ data: { id: ids.user, email: `links-${run}@capturetracker.local`, displayName: "Link fixture", emailVerified: true } });
    await prisma.business.createMany({ data: [{ id: ids.businessA, legalName: "Links A LLC", displayName: "Links A" }, { id: ids.businessB, legalName: "Links B LLC", displayName: "Links B" }] });
    await prisma.businessMember.createMany({ data: [{ id: `link-member-a-${run}`, businessId: ids.businessA, userId: ids.user, role: "OWNER" }, { id: `link-member-b-${run}`, businessId: ids.businessB, userId: ids.user, role: "OWNER" }] });
    await prisma.financialAccount.createMany({ data: [{ id: ids.accountA, businessId: ids.businessA, name: "Links A checking", type: "CHECKING", ownership: "BUSINESS", openingBalance: "0.00" }, { id: ids.accountB, businessId: ids.businessB, name: "Links B checking", type: "CHECKING", ownership: "BUSINESS", openingBalance: "0.00" }] });
    await prisma.transaction.createMany({ data: [{ id: ids.transactionA, businessId: ids.businessA, accountId: ids.accountA, postedAt: new Date(), description: "Link test A", amount: "10.00", direction: "OUTFLOW", sourceReference: `link-a-${run}` }, { id: ids.transactionB, businessId: ids.businessB, accountId: ids.accountB, postedAt: new Date(), description: "Link test B", amount: "20.00", direction: "OUTFLOW", sourceReference: `link-b-${run}` }] });
    await prisma.document.createMany({ data: [documentData(ids.cleanDocument, ids.businessA, "a"), documentData(ids.cleanDocumentTwo, ids.businessA, "d"), documentData(ids.pendingDocument, ids.businessA, "b", false), documentData(ids.otherDocument, ids.businessB, "c")] });
  });

  afterAll(async () => {
    await prisma.transactionDocumentHistory.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.transactionDocument.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.document.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.transaction.deleteMany({ where: { id: { in: [ids.transactionA, ids.transactionB] } } });
    await prisma.financialAccount.deleteMany({ where: { id: { in: [ids.accountA, ids.accountB] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [ids.businessA, ids.businessB] } } });
    await prisma.business.deleteMany({ where: { id: { in: [ids.businessA, ids.businessB] } } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await rollbackPrisma.$disconnect();
    await prisma.$disconnect();
  });

  it("rejects cross-business and non-clean document linking without exposing records", async () => {
    await expect(linkDocumentToTransaction(prisma, actorA, ids.transactionA, ids.otherDocument)).resolves.toMatchObject({ ok: false, code: "NOT_FOUND" });
    await expect(linkDocumentToTransaction(prisma, actorA, ids.transactionA, ids.pendingDocument)).resolves.toMatchObject({ ok: false, code: "DOCUMENT_NOT_ELIGIBLE" });
  });

  it("creates one canonical active relationship and one LINKED event under duplicate concurrency", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => linkDocumentToTransaction(prisma, actorA, ids.transactionA, ids.cleanDocument)));
    expect(results.every((result) => result.ok)).toBe(true);
    expect(await prisma.transactionDocument.count({ where: { businessId: ids.businessA, transactionId: ids.transactionA, documentId: ids.cleanDocument, unlinkedAt: null } })).toBe(1);
    expect(await prisma.transactionDocumentHistory.count({ where: { businessId: ids.businessA, action: "LINKED", link: { transactionId: ids.transactionA, documentId: ids.cleanDocument } } })).toBe(1);
  });

  it("rolls back link and unlink changes when the actor relationship is invalid", async () => {
    const linkBefore = await prisma.transactionDocument.count({ where: { businessId: ids.businessA } });
    const invalidLink = await linkDocumentToTransaction(rollbackPrisma, { ...actorA, actorUserId: `missing-${run}` }, ids.transactionA, ids.cleanDocumentTwo);
    expect(invalidLink).toMatchObject({ ok: false, code: "INVALID" });
    expect(await prisma.transactionDocument.count({ where: { businessId: ids.businessA } })).toBe(linkBefore);
    const canonical = await prisma.transactionDocument.findFirstOrThrow({ where: { businessId: ids.businessA, transactionId: ids.transactionA, documentId: ids.cleanDocument, unlinkedAt: null } });
    const invalidUnlink = await unlinkDocumentFromTransaction(rollbackPrisma, { ...actorA, actorUserId: `missing-${run}` }, canonical.id);
    expect(invalidUnlink).toMatchObject({ ok: false, code: "INVALID" });
    expect(await prisma.transactionDocument.findFirst({ where: { id: canonical.id, unlinkedAt: null } })).not.toBeNull();
    expect(await prisma.transactionDocumentHistory.count({ where: { transactionDocumentId: canonical.id, action: "UNLINKED" } })).toBe(0);
  });

  it("unlinks idempotently, preserves history on relink, and leaves accounting unchanged", async () => {
    const canonical = await prisma.transactionDocument.findFirstOrThrow({ where: { businessId: ids.businessA, transactionId: ids.transactionA, documentId: ids.cleanDocument, unlinkedAt: null } });
    const before = await Promise.all([prisma.transaction.findUniqueOrThrow({ where: { id: ids.transactionA } }), prisma.journalEntry.count({ where: { businessId: ids.businessA } }), prisma.journalLine.count({ where: { businessId: ids.businessA } })]);
    const unlinks = await Promise.all([unlinkDocumentFromTransaction(prisma, actorA, canonical.id), unlinkDocumentFromTransaction(prisma, actorA, canonical.id)]);
    expect(unlinks.filter((result) => result.ok && result.state === "UNLINKED")).toHaveLength(1);
    expect(await prisma.transactionDocumentHistory.count({ where: { transactionDocumentId: canonical.id, action: "UNLINKED" } })).toBe(1);
    await expect(linkDocumentToTransaction(prisma, actorA, ids.transactionA, ids.cleanDocument)).resolves.toMatchObject({ ok: true, state: "LINKED" });
    expect(await prisma.transactionDocument.count({ where: { businessId: ids.businessA, transactionId: ids.transactionA, documentId: ids.cleanDocument } })).toBe(2);
    expect(await prisma.transactionDocumentHistory.count({ where: { businessId: ids.businessA, action: "LINKED", link: { transactionId: ids.transactionA, documentId: ids.cleanDocument } } })).toBe(2);
    const after = await Promise.all([prisma.transaction.findUniqueOrThrow({ where: { id: ids.transactionA } }), prisma.journalEntry.count({ where: { businessId: ids.businessA } }), prisma.journalLine.count({ where: { businessId: ids.businessA } })]);
    expect(after[0]).toMatchObject({ amount: before[0].amount, version: before[0].version, status: before[0].status });
    expect(after.slice(1)).toEqual(before.slice(1));
  });
});
