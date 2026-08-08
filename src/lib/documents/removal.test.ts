import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ document: { findFirst: vi.fn() }, $queryRaw: vi.fn() }));
const storage = vi.hoisted(() => ({ removeQuarantined: vi.fn(), removeActive: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("./r2-storage", () => ({ getPrivateDocumentStorage: vi.fn(async () => storage) }));

describe("private document removal", () => {
  const actor = { businessId: "business_a", actorUserId: "member_a" };
  const unlinked = { id: "doc_a", businessId: "business_a", storageKey: "opaque", transactions: [], reimbursementExpenses: [], payrollRuns: [], taxPayments: [] };
  beforeEach(() => {
    prisma.document.findFirst.mockReset(); prisma.$queryRaw.mockReset();
    storage.removeQuarantined.mockReset(); storage.removeActive.mockReset();
    prisma.document.findFirst.mockResolvedValue(unlinked);
    prisma.$queryRaw.mockResolvedValue([{ id: "doc_a" }]);
    storage.removeQuarantined.mockResolvedValue(undefined); storage.removeActive.mockResolvedValue(undefined);
  });

  it("tombstones an unlinked document before removing both private object prefixes", async () => {
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_a")).resolves.toEqual({ ok: true, mode: "DELETED", cleanupPending: false });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.removeQuarantined).toHaveBeenCalledWith("opaque");
    expect(storage.removeActive).toHaveBeenCalledWith("opaque");
  });

  it("archives linked evidence without deleting retained private bytes", async () => {
    prisma.document.findFirst.mockResolvedValue({ ...unlinked, transactions: [{ id: "link" }] });
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_a")).resolves.toEqual({ ok: true, mode: "ARCHIVED", cleanupPending: false });
    expect(storage.removeQuarantined).not.toHaveBeenCalled(); expect(storage.removeActive).not.toHaveBeenCalled();
  });

  it("denies another tenant or an already deleted document before storage access", async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    const { removePrivateDocument } = await import("./removal");
    await expect(removePrivateDocument(actor, "doc_b")).resolves.toEqual({ ok: false, code: "NOT_FOUND" });
    expect(prisma.$queryRaw).not.toHaveBeenCalled(); expect(storage.removeActive).not.toHaveBeenCalled();
  });
});
