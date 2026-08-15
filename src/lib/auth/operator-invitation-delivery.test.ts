import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/accounting/workspace-bootstrap", () => ({
  workspaceAccountingFoundationOperations: () => [],
}));

const actor = {
  userId: "operator-1",
  email: "operator@example.test",
  displayName: "Operator",
};
const input = {
  invitedEmail: "CLIENT@example.test",
  ownerDisplayName: "Fictional Owner",
  businessLegalName: "Fictional Legal LLC",
  businessDisplayName: "Fictional Workspace",
  foundingCustomer: false,
};
const record = (overrides: Record<string, unknown> = {}) => ({
  id: "invite-1",
  invitedEmail: "client@example.test",
  ownerDisplayName: "Fictional Owner",
  businessLegalName: "Fictional Legal LLC",
  businessDisplayName: "Fictional Workspace",
  customerExperience: "STANDARD",
  tokenHash: "hash",
  createdByUserId: actor.userId,
  acceptedByUserId: null,
  provisionedBusinessId: null,
  status: "PENDING",
  createdAt: new Date("2026-08-15T12:00:00Z"),
  expiresAt: new Date("2026-08-18T12:00:00Z"),
  acceptedAt: null,
  revokedAt: null,
  emailDeliveryStatus: "NOT_SENT",
  emailDeliveryAttemptedAt: null,
  emailDeliveryError: null,
  version: 1,
  ...overrides,
});

function clientForCreate(
  overrides: { active?: unknown; sendUpdateCounts?: number[] } = {},
) {
  const created = record();
  const tx = {
    operatorInvitation: {
      findFirst: vi.fn().mockResolvedValue(overrides.active ?? null),
      create: vi.fn().mockResolvedValue(created),
      updateMany: vi.fn(),
    },
    operatorInvitationEvent: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
  for (const count of overrides.sendUpdateCounts ?? [1, 1])
    tx.operatorInvitation.updateMany.mockResolvedValueOnce({ count });
  const client = {
    $transaction: vi.fn(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  return { client, tx, created };
}

describe("operator invitation email delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates one hashed invitation and sends only trusted server-rendered fields", async () => {
    const { client, tx } = clientForCreate();
    const sendEmail = vi
      .fn()
      .mockResolvedValue({
        provider: "CLOUDFLARE_EMAIL_SERVICE",
        messageId: "message_1",
      });
    const { createOperatorInvitation } = await import("./operator-invitations");
    const result = await createOperatorInvitation(
      actor,
      input,
      "https://example.test",
      client as never,
      { sendEmail },
    );
    expect(result.emailDeliveryStatus).toBe("SENT");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "client@example.test",
        ownerDisplayName: input.ownerDisplayName,
        businessDisplayName: input.businessDisplayName,
        invitationUrl: result.invitationUrl,
      }),
    );
    const createdData = tx.operatorInvitation.create.mock.calls[0][0].data;
    const rawToken = result.invitationUrl.split("/").at(-1);
    expect(createdData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdData.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(createdData)).not.toContain(result.invitationUrl);
    expect(tx.operatorInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ emailDeliveryStatus: "NOT_SENT" }),
        data: expect.objectContaining({ emailDeliveryStatus: "SENDING" }),
      }),
    );
    expect(tx.operatorInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ emailDeliveryStatus: "SENDING" }),
        data: expect.objectContaining({ emailDeliveryStatus: "SENT" }),
      }),
    );
  });

  it("keeps the invitation and records a sanitized failure when sending is rejected", async () => {
    const { client, tx } = clientForCreate();
    const { CustomerInvitationEmailError } =
      await import("@/lib/email/customer-invitation-email");
    const sendEmail = vi
      .fn()
      .mockRejectedValue(new CustomerInvitationEmailError("RATE_LIMITED"));
    const { createOperatorInvitation } = await import("./operator-invitations");
    const result = await createOperatorInvitation(
      actor,
      input,
      "https://example.test",
      client as never,
      { sendEmail },
    );
    expect(result.emailDeliveryStatus).toBe("FAILED");
    expect(result.invitationUrl).toContain("/invite/");
    expect(tx.operatorInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailDeliveryStatus: "FAILED",
          emailDeliveryError: "RATE_LIMITED",
        }),
      }),
    );
    expect(tx.operatorInvitationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "INVITATION_EMAIL_FAILED",
        failureCode: "RATE_LIMITED",
      }),
    });
  });

  it("blocks duplicate active invitations before generating another send", async () => {
    const { client, tx } = clientForCreate({ active: { id: "existing" } });
    const sendEmail = vi.fn();
    const { createOperatorInvitation } = await import("./operator-invitations");
    await expect(
      createOperatorInvitation(
        actor,
        input,
        "https://example.test",
        client as never,
        { sendEmail },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.operatorInvitation.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reissues atomically from persisted identity, revokes the prior link, and sends once", async () => {
    const previous = record({
      id: "old-invite",
      emailDeliveryStatus: "FAILED",
      version: 4,
    });
    const replacement = record({ id: "new-invite", tokenHash: "new-hash" });
    const tx = {
      operatorInvitation: {
        findFirst: vi.fn().mockResolvedValue(previous),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 }),
        create: vi.fn().mockResolvedValue(replacement),
      },
      operatorInvitationEvent: {
        create: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const sendEmail = vi
      .fn()
      .mockResolvedValue({
        provider: "CLOUDFLARE_EMAIL_SERVICE",
        messageId: "message_2",
      });
    const { reissueOperatorInvitation } =
      await import("./operator-invitations");
    const result = await reissueOperatorInvitation(
      actor,
      previous.id,
      "https://example.test",
      client as never,
      sendEmail,
    );
    expect(result.invitation.id).toBe("new-invite");
    expect(tx.operatorInvitation.updateMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ id: "old-invite", version: 4 }),
        data: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
    expect(tx.operatorInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        invitedEmail: previous.invitedEmail,
        businessLegalName: previous.businessLegalName,
        businessDisplayName: previous.businessDisplayName,
        emailDeliveryStatus: "NOT_SENT",
      }),
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: previous.invitedEmail,
        businessDisplayName: previous.businessDisplayName,
      }),
    );
  });

  it("does not send when a concurrent reissue loses the version claim", async () => {
    const previous = record({ id: "old-invite", version: 7 });
    const tx = {
      operatorInvitation: {
        findFirst: vi.fn().mockResolvedValue(previous),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn(),
      },
      operatorInvitationEvent: { create: vi.fn(), createMany: vi.fn() },
    };
    const client = {
      $transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const sendEmail = vi.fn();
    const { reissueOperatorInvitation } =
      await import("./operator-invitations");
    await expect(
      reissueOperatorInvitation(
        actor,
        previous.id,
        "https://example.test",
        client as never,
        sendEmail,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(tx.operatorInvitation.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
