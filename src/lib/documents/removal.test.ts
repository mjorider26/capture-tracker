import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ document: { findFirst: vi.fn() }, $transaction: vi.fn() }));
const storage = vi.hoisted(() => ({ removeQuarantined: vi.fn(), removeActive: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("./r2-storage", () => ({ getPrivateDocumentStorage: vi.fn(async () => storage) }));

describe("private document removal", () => {
  const actor = { businessId: "business_a", actorUserId: "member_a" };
  const unlinked = { id: "doc_a", businessId: "business_a", storageKey: "opaque", transactions: [], reimbursementExpenses: [], payrollRuns: [], taxPayments: [] };
  const tx = { document: { updateMany: vi.fn() }, auditEvent: { create: vi.fn() } };

  beforeEach(() => {
    prisma.document.findFirst.mockReset(); prisma.$transaction.mockReset();
    tx.document.updateMany.mockReset(); tx.auditEvent.create.mockReset();
    storage.removeQuarantined.mockReset(); storage.removeActive.mockReset();
    prisma.document.findFirst.mockResolvedValue(unlinked);
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    tx.document.updateMany.mockResolvedValue({ count: 1 }); tx.auditEvent.create.mockResolvedValue({});
    storage.removeQuarantined.mockResolvedValue(undefined); storage.removeActive.mockResolvedValue(undefined);
  });

  it("tombstones an unlinked document before removing both private object prefixes", async () => {
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_a")).resolves.toEqual({ ok: true, mode: "DELETED", cleanupPending: false });
    expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "business_a", deletedAt: null }), data: expect.objectContaining({ privateReadEligible: false, version: { increment: 1 } }) }));
    expect(storage.removeQuarantined).toHaveBeenCalledWith("opaque");
    expect(storage.removeActive).toHaveBeenCalledWith("opaque");
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "DELETE", metadataJson: { documentRemoval: "DELETED_UNLINKED" } }) }));
  });

  it("archives linked evidence without deleting retained private bytes", async () => {
    prisma.document.findFirst.mockResolvedValue({ ...unlinked, transactions: [{ id: "link" }] });
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_a")).resolves.toEqual({ ok: true, mode: "ARCHIVED", cleanupPending: false });
    expect(storage.removeQuarantined).not.toHaveBeenCalled(); expect(storage.removeActive).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "UPDATE", metadataJson: { documentRemoval: "ARCHIVED_LINKED_EVIDENCE" } }) }));
  });

  it("denies another tenant or an already deleted document before storage access", async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_b")).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(prisma.$transaction).not.toHaveBeenCalled(); expect(storage.removeActive).not.toHaveBeenCalled();
  });
});
