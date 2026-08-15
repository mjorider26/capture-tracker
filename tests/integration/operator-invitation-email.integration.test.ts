import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createOperatorInvitation,
  readInvitationByToken,
  reissueOperatorInvitation,
} from "@/lib/auth/operator-invitations";
import { createPrismaClient } from "@/lib/database/create-prisma-client";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured.");

const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const actor = {
  userId: `invitation-operator-${run}`,
  email: `operator-${run}@capturetracker.local`,
  displayName: "Fictional Operator",
};
const otherActor = {
  userId: `invitation-other-${run}`,
  email: `other-${run}@capturetracker.local`,
  displayName: "Other Operator",
};
const invitedEmail = `invited-${run}@capturetracker.local`;
const manualEmail = `manual-${run}@capturetracker.local`;
const invitationInput = {
  invitedEmail,
  ownerDisplayName: "Fictional Owner",
  businessLegalName: "Fictional Legal LLC",
  businessDisplayName: "Fictional Workspace",
  foundingCustomer: false,
};
let originalInvitationUrl = "";

describe("operator invitation email lifecycle with PostgreSQL 17", () => {
  afterAll(async () => {
    const invitations = await prisma.operatorInvitation.findMany({
      where: { invitedEmail: { in: [invitedEmail, manualEmail] } },
      select: { id: true },
    });
    await prisma.operatorInvitationEvent.deleteMany({
      where: { invitationId: { in: invitations.map((item) => item.id) } },
    });
    await prisma.operatorInvitation.deleteMany({
      where: { id: { in: invitations.map((item) => item.id) } },
    });
    await prisma.$disconnect();
  });

  it("serializes concurrent create attempts so only one invitation and one email send succeed", async () => {
    const sendEmail = vi
      .fn()
      .mockResolvedValue({
        provider: "CLOUDFLARE_EMAIL_SERVICE" as const,
        messageId: "fictional-message-1",
      });
    const attempts = await Promise.allSettled([
      createOperatorInvitation(
        actor,
        invitationInput,
        "https://example.test",
        prisma,
        { sendEmail },
      ),
      createOperatorInvitation(
        actor,
        invitationInput,
        "https://example.test",
        prisma,
        { sendEmail },
      ),
    ]);
    const fulfilled = attempts.filter(
      (
        attempt,
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<typeof createOperatorInvitation>>
      > => attempt.status === "fulfilled",
    );
    expect(fulfilled).toHaveLength(1);
    originalInvitationUrl = fulfilled[0].value.invitationUrl;
    expect(sendEmail).toHaveBeenCalledTimes(1);
    await expect(
      prisma.operatorInvitation.count({ where: { invitedEmail } }),
    ).resolves.toBe(1);
    const stored = await prisma.operatorInvitation.findFirstOrThrow({
      where: { invitedEmail },
    });
    expect(stored.emailDeliveryStatus).toBe("SENT");
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.operatorInvitationEvent.findMany({
        where: { invitationId: stored.id },
        orderBy: { occurredAt: "asc" },
        select: { event: true },
      }),
    ).toEqual([
      { event: "INVITATION_CREATED" },
      { event: "INVITATION_EMAIL_SENDING" },
      { event: "INVITATION_EMAIL_ACCEPTED" },
    ]);
  });

  it("reissues from trusted persisted identity, invalidates the old link, and blocks another operator", async () => {
    const current = await prisma.operatorInvitation.findFirstOrThrow({
      where: { invitedEmail, status: "PENDING" },
    });
    const firstCreateEvent =
      await prisma.operatorInvitationEvent.findFirstOrThrow({
        where: { invitationId: current.id, event: "INVITATION_CREATED" },
      });
    expect(firstCreateEvent.providerMessageId).toBeNull();
    await expect(
      reissueOperatorInvitation(
        otherActor,
        current.id,
        "https://example.test",
        prisma,
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const sendEmail = vi
      .fn()
      .mockResolvedValue({
        provider: "CLOUDFLARE_EMAIL_SERVICE" as const,
        messageId: "fictional-message-2",
      });
    const replacement = await reissueOperatorInvitation(
      actor,
      current.id,
      "https://example.test",
      prisma,
      sendEmail,
    );
    const oldToken = (
      await prisma.operatorInvitation.findUniqueOrThrow({
        where: { id: current.id },
      })
    ).tokenHash;
    expect(oldToken).not.toBe(replacement.invitationUrl.split("/").at(-1));
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: invitedEmail,
        ownerDisplayName: invitationInput.ownerDisplayName,
        businessDisplayName: invitationInput.businessDisplayName,
      }),
    );
    await expect(
      prisma.operatorInvitation.count({
        where: { invitedEmail, status: "PENDING" },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.operatorInvitation.count({
        where: { invitedEmail, status: "REVOKED" },
      }),
    ).resolves.toBe(1);
    const oldRawToken = originalInvitationUrl.split("/").at(-1) ?? "";
    expect(await readInvitationByToken(oldRawToken, prisma)).toMatchObject({
      usable: false,
      reason: "REVOKED",
    });
    const newRawToken = replacement.invitationUrl.split("/").at(-1) ?? "";
    expect(await readInvitationByToken(newRawToken, prisma)).toMatchObject({
      usable: true,
      email: invitedEmail,
    });
  });

  it("keeps the explicit manual secure-link fallback without invoking the provider", async () => {
    const sendEmail = vi.fn();
    const result = await createOperatorInvitation(
      actor,
      { ...invitationInput, invitedEmail: manualEmail },
      "https://example.test",
      prisma,
      { deliveryMode: "MANUAL", sendEmail },
    );
    expect(result.emailDeliveryStatus).toBe("MANUAL_REQUIRED");
    expect(result.invitationUrl).toContain("/invite/");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
