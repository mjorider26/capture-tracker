import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseDocumentScanJob, parseDocumentScanResult } from "./scan-contract";

const prisma = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const storage = vi.hoisted(() => ({ promoteQuarantined: vi.fn(), finalizeQuarantinedPromotion: vi.fn(), getQuarantined: vi.fn(), getActive: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("./r2-storage", () => ({ getPrivateDocumentStorage: vi.fn(async () => storage) }));

describe("document scan lifecycle contracts", () => {
  it("accepts only minimal opaque queue identifiers", () => {
    expect(parseDocumentScanJob({ documentId: "doc_123", version: 1 })).toEqual({ documentId: "doc_123", version: 1 });
    expect(parseDocumentScanJob({ documentId: "doc_123", version: 1, trace: { correlationId: "a".repeat(32), timings: [{ stage: "UPLOAD_COMPLETED", at: "2026-08-08T04:00:00.000Z" }] } })).toEqual({ documentId: "doc_123", version: 1, trace: { correlationId: "a".repeat(32), timings: [{ stage: "UPLOAD_COMPLETED", at: "2026-08-08T04:00:00.000Z" }] } });
    expect(parseDocumentScanJob({ documentId: "doc_123", version: 0 })).toBeNull();
    expect(parseDocumentScanJob({ documentId: "doc/123", version: 1 })).toBeNull();
    expect(parseDocumentScanJob({ documentId: "doc_123", version: "1" })).toBeNull();
    expect(parseDocumentScanJob({ documentId: "doc_123", version: 1, trace: { correlationId: "not-safe", timings: [] } })).toBeNull();
  });

  it("accepts only sanitized scanner result categories", () => {
    expect(parseDocumentScanResult({ category: "CLEAN", scannerId: "clamav", scannerVersion: "1.4.3" })).toEqual({ category: "CLEAN", scannerId: "clamav", scannerVersion: "1.4.3" });
    expect(parseDocumentScanResult({ category: "INFECTED", scannerId: "clamav" })).toEqual({ category: "INFECTED", scannerId: "clamav" });
    expect(parseDocumentScanResult({ category: "CLEAN", scannerId: 1 })).toBeNull();
    expect(parseDocumentScanResult({ category: "UNKNOWN", scannerId: "clamav" })).toBeNull();
  });
});

describe("document scan lifecycle application", () => {
  const target = { id: "doc_123", businessId: "business_123", version: 1, storageKey: "opaque-key", mimeType: "image/png", uploadedByMembershipId: "member_123" };
  const tx = { document: { updateMany: vi.fn() }, documentStatusHistory: { create: vi.fn() }, auditEvent: { create: vi.fn() } };

  beforeEach(() => {
    prisma.document.findFirst.mockReset();
    prisma.$transaction.mockReset();
    storage.promoteQuarantined.mockReset();
    storage.finalizeQuarantinedPromotion.mockReset();
    storage.getQuarantined.mockReset();
    storage.getActive.mockReset();
    tx.document.updateMany.mockReset();
    tx.documentStatusHistory.create.mockReset();
    tx.auditEvent.create.mockReset();
    prisma.document.findFirst.mockResolvedValue(target);
    prisma.$transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
    tx.document.updateMany.mockResolvedValue({ count: 1 });
    tx.documentStatusHistory.create.mockResolvedValue({});
    tx.auditEvent.create.mockResolvedValue({});
    storage.promoteQuarantined.mockResolvedValue(undefined);
    storage.finalizeQuarantinedPromotion.mockResolvedValue(undefined);
  });

  it("promotes only a current quarantined document after a clean result and records one audit event", async () => {
    const { applyDocumentScanResult } = await import("./scan-lifecycle");
    await expect(applyDocumentScanResult({ documentId: "doc_123", version: 1 }, { category: "CLEAN", scannerId: "clamav", scannerVersion: "1.4.3" })).resolves.toEqual({ state: "ACTIVATED" });
    expect(storage.promoteQuarantined).toHaveBeenCalledWith("opaque-key");
    expect(storage.finalizeQuarantinedPromotion).toHaveBeenCalledWith("opaque-key");
    expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "doc_123", version: 1, status: "QUARANTINED", malwareScanStatus: "PENDING" }), data: expect.objectContaining({ status: "ACTIVE", malwareScanStatus: "CLEAN", privateReadEligible: true }) }));
    expect(tx.documentStatusHistory.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it("makes a duplicate clean delivery a no-op instead of activating or auditing twice", async () => {
    const { applyDocumentScanResult } = await import("./scan-lifecycle");
    tx.document.updateMany.mockResolvedValue({ count: 0 });
    await expect(applyDocumentScanResult({ documentId: "doc_123", version: 1 }, { category: "CLEAN", scannerId: "clamav" })).resolves.toEqual({ state: "STALE" });
    expect(tx.documentStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an infected result without promoting its quarantined bytes", async () => {
    const { applyDocumentScanResult } = await import("./scan-lifecycle");
    await expect(applyDocumentScanResult({ documentId: "doc_123", version: 1 }, { category: "INFECTED", scannerId: "clamav" })).resolves.toEqual({ state: "REJECTED" });
    expect(storage.promoteQuarantined).not.toHaveBeenCalled();
    expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED", malwareScanStatus: "INFECTED", privateReadEligible: false }) }));
  });

  it("keeps a scanner failure quarantined and unreadable", async () => {
    const { applyDocumentScanResult } = await import("./scan-lifecycle");
    await expect(applyDocumentScanResult({ documentId: "doc_123", version: 1 }, { category: "FAILED", scannerId: "clamav" })).resolves.toEqual({ state: "FAILED" });
    expect(storage.promoteQuarantined).not.toHaveBeenCalled();
    expect(tx.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ malwareScanStatus: "FAILED" }) }));
  });
});
