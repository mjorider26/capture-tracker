import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/accounting/workspace-bootstrap", () => ({ workspaceAccountingFoundationOperations: () => [] }));

const invitation = (overrides: Record<string, unknown> = {}) => ({ id: "invite_1", invitedEmail: "client@example.test", ownerDisplayName: "Client", businessLegalName: "Client Corp", businessDisplayName: "Client", tokenHash: "", createdByUserId: "operator", acceptedByUserId: null, provisionedBusinessId: null, status: "PENDING", createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000), acceptedAt: null, revokedAt: null, version: 1, ...overrides });

describe("operator invitation acceptance", () => {
  beforeEach(() => vi.clearAllMocks());
  it("creates exactly one sole-owner foundation only after an email-bound conditional acceptance", async () => {
    const { invitationTokenHash } = await import("./operator-invitations-core"); const token = "a".repeat(64); const record = invitation({ tokenHash: await invitationTokenHash(token) });
    const tx = { operatorInvitation: { findUnique: vi.fn().mockResolvedValue(record), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, businessMember: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockResolvedValue({}) }, business: { create: vi.fn().mockResolvedValue({}) }, businessOnboarding: { create: vi.fn().mockResolvedValue({}) }, businessSettings: { create: vi.fn().mockResolvedValue({}) }, businessCutover: { create: vi.fn().mockResolvedValue({}) }, auditEvent: { create: vi.fn().mockResolvedValue({}) } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    const { acceptOperatorInvitation } = await import("./operator-invitations"); const accepted = await acceptOperatorInvitation({ token, userId: "client-user", email: "CLIENT@example.test", client: client as never });
    expect(accepted.businessId).toBe("operator-invite-invite_1-business"); expect(tx.operatorInvitation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "PENDING", version: 1 }), data: expect.objectContaining({ status: "ACCEPTED", acceptedByUserId: "client-user" }) })); expect(tx.businessMember.create).toHaveBeenCalledWith({ data: { businessId: accepted.businessId, userId: "client-user", role: "OWNER" } }); expect(tx.auditEvent.create).toHaveBeenCalled();
  });
  it("rejects a wrong email, expired invitation, and concurrent reuse before creating a business", async () => {
    const { invitationTokenHash } = await import("./operator-invitations-core"); const token = "b".repeat(64); const base = invitation({ tokenHash: await invitationTokenHash(token) });
    const tx = { operatorInvitation: { findUnique: vi.fn().mockResolvedValue(base), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, businessMember: { count: vi.fn().mockResolvedValue(0), create: vi.fn() }, business: { create: vi.fn() }, businessOnboarding: { create: vi.fn() }, businessSettings: { create: vi.fn() }, businessCutover: { create: vi.fn() }, auditEvent: { create: vi.fn() } };
    const client = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) }; const { acceptOperatorInvitation } = await import("./operator-invitations");
    await expect(acceptOperatorInvitation({ token, userId: "attacker", email: "attacker@example.test", client: client as never })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(tx.business.create).not.toHaveBeenCalled();
    tx.operatorInvitation.findUnique.mockResolvedValue(invitation({ tokenHash: await invitationTokenHash(token), expiresAt: new Date(Date.now() - 1) })); await expect(acceptOperatorInvitation({ token, userId: "client", email: "client@example.test", client: client as never })).rejects.toMatchObject({ code: "EXPIRED" });
    tx.operatorInvitation.findUnique.mockResolvedValue(base); tx.operatorInvitation.updateMany.mockResolvedValue({ count: 0 }); await expect(acceptOperatorInvitation({ token, userId: "client", email: "client@example.test", client: client as never })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
