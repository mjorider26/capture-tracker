import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveFixedAssetInService } from "./fixed-assets";

const actor = { businessId: "business_a", actorUserId: "user_a", role: "OWNER" as const, executionMode: "authenticated" };
const transactionClient = (tx: Record<string, unknown>) => ({ $transaction: async (work: (database: typeof tx) => unknown) => work(tx) });
const asset = { id: "asset_a", status: "POSSIBLE_REVIEW", version: 4, acquisitionDate: new Date("2026-07-03T12:00:00.000Z") };

describe("fixed-asset in-service approval", () => {
  const findFirst = vi.fn();
  const updateMany = vi.fn();
  const auditCreate = vi.fn();
  const tx = { fixedAsset: { findFirst, updateMany }, auditEvent: { create: auditCreate } };

  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(asset);
    updateMany.mockResolvedValue({ count: 1 });
    auditCreate.mockResolvedValue({ id: "audit_a" });
  });

  it("requires an owner, a placed-in-service date, and explicit confirmation", async () => {
    const client = transactionClient(tx) as never;
    await expect(approveFixedAssetInService(client, { ...actor, role: "ADVISOR" }, { assetId: asset.id, version: asset.version, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: asset.version, confirmation: "on" })).resolves.toMatchObject({ ok: false });
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: asset.version, placedInServiceDate: "2026-07-05" })).resolves.toMatchObject({ ok: false });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("atomically moves a tenant-scoped possible asset to in service and preserves source relationships", async () => {
    const client = transactionClient(tx) as never;
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: asset.version, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toEqual({ ok: true, assetId: asset.id });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: asset.id, businessId: actor.businessId } }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: asset.id, businessId: actor.businessId, status: "POSSIBLE_REVIEW", version: asset.version },
      data: expect.objectContaining({ status: "IN_SERVICE", approvedByMembershipId: actor.actorUserId, version: { increment: 1 } }),
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "APPROVE", entityType: "FixedAsset", entityId: asset.id }) }));
    expect(JSON.stringify(updateMany.mock.calls[0][0].data)).not.toContain("source");
    expect((tx as Record<string, unknown>).journalEntry).toBeUndefined();
  });

  it("denies foreign, stale, repeated, and pre-acquisition approval attempts without partial success", async () => {
    const client = transactionClient(tx) as never;
    findFirst.mockResolvedValueOnce(null);
    await expect(approveFixedAssetInService(client, actor, { assetId: "foreign_asset", version: 4, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    findFirst.mockResolvedValueOnce(asset);
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: 3, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    findFirst.mockResolvedValueOnce({ ...asset, status: "IN_SERVICE" });
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: 4, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    findFirst.mockResolvedValueOnce(asset);
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: 4, placedInServiceDate: "2026-07-01", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    expect(updateMany).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("fails safely when a concurrent approval has already consumed the expected version", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });
    const client = transactionClient(tx) as never;
    await expect(approveFixedAssetInService(client, actor, { assetId: asset.id, version: 4, placedInServiceDate: "2026-07-05", confirmation: "on" })).resolves.toMatchObject({ ok: false });
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
