import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
const prismaMock = vi.hoisted(() => ({ transaction: { count: vi.fn(), findMany: vi.fn() }, exportAudit: { create: vi.fn() } }));
vi.mock("../prisma", () => ({ prisma: prismaMock }));
vi.mock("../data/reports", () => ({ getFinancialReports: vi.fn() }));

import { buildExport } from "./pilot-readiness";

describe("pilot export completeness", () => {
  beforeEach(() => vi.clearAllMocks());
  it("exports all records beyond the prior 1,000-record cap", async () => {
    const records = Array.from({ length: 1001 }, (_, index) => ({ postedAt: new Date("2026-08-01T00:00:00.000Z"), description: `Transaction ${index}`, merchantName: null, amount: new Prisma.Decimal("1.00"), status: "POSTED", intent: "BUSINESS" }));
    prismaMock.transaction.count.mockResolvedValueOnce(records.length);
    prismaMock.transaction.findMany.mockResolvedValueOnce(records);
    prismaMock.exportAudit.create.mockResolvedValueOnce({});
    const result = await buildExport({ businessId: "business-a", actorUserId: "user-a" }, "TRANSACTIONS");
    expect(result?.csv.split("\n")).toHaveLength(1002);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
    expect(prismaMock.exportAudit.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rowCount: 1001, businessId: "business-a" }) }));
  });

  it("fails closed instead of producing a truncated file above the safety maximum", async () => {
    prismaMock.transaction.count.mockResolvedValueOnce(50_001);
    await expect(buildExport({ businessId: "business-a", actorUserId: "user-a" }, "TRANSACTIONS")).rejects.toThrow("EXPORT_TOO_LARGE");
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });
});
