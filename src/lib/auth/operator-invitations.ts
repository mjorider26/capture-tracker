import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { workspaceAccountingFoundationOperations } from "@/lib/accounting/workspace-bootstrap";
import {
  CustomerInvitationEmailError,
  sendCustomerInvitationEmail,
  type CustomerInvitationEmailInput,
  type CustomerInvitationEmailResult,
} from "@/lib/email/customer-invitation-email";
import { prisma } from "@/lib/prisma";

import {
  invitationExpiresAt,
  invitationTokenHash,
  invitationUsable,
  newInvitationToken,
  parseOperatorInvitationInput,
} from "./operator-invitations-core";
import { normalizeOperatorEmail } from "./operator-authorization-core";

type Database = PrismaClient;
type InvitationActor = { userId: string; email: string; displayName: string };
type InvitationDeliveryMode = "EMAIL" | "MANUAL";
type InvitationEmailSender = (
  input: CustomerInvitationEmailInput,
) => Promise<CustomerInvitationEmailResult>;
const id = (invitationId: string, suffix: string) =>
  `operator-invite-${invitationId}-${suffix}`;

export class InvitationError extends Error {
  constructor(
    public readonly code:
      | "INVALID"
      | "NOT_FOUND"
      | "EXPIRED"
      | "FORBIDDEN"
      | "CONFLICT"
      | "PROVISIONING_FAILED",
  ) {
    super(code);
    this.name = "InvitationError";
  }
}

export async function createOperatorInvitation(
  actor: InvitationActor,
  input: unknown,
  origin: string,
  client: Database = prisma,
  options: {
    deliveryMode?: InvitationDeliveryMode;
    sendEmail?: InvitationEmailSender;
  } = {},
) {
  const parsed = parseOperatorInvitationInput(input);
  if (!parsed) throw new InvitationError("INVALID");
  const token = newInvitationToken();
  const tokenHash = await invitationTokenHash(token);
  const invitedEmail = normalizeOperatorEmail(parsed.invitedEmail);
  const deliveryMode = options.deliveryMode ?? "EMAIL";
  const { foundingCustomer, ...details } = parsed;
  const now = new Date();
  const invitation = await client.$transaction(
    async (tx) => {
      const active = await tx.operatorInvitation.findFirst({
        where: {
          invitedEmail,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (active) throw new InvitationError("CONFLICT");
      const created = await tx.operatorInvitation.create({
        data: {
          ...details,
          customerExperience: foundingCustomer
            ? "FOUNDING_CUSTOMER"
            : "STANDARD",
          invitedEmail,
          tokenHash,
          createdByUserId: actor.userId,
          expiresAt: invitationExpiresAt(now),
          emailDeliveryStatus:
            deliveryMode === "EMAIL" ? "NOT_SENT" : "MANUAL_REQUIRED",
        },
      });
      await tx.operatorInvitationEvent.create({
        data: {
          invitationId: created.id,
          actorUserId: actor.userId,
          event: "INVITATION_CREATED",
        },
      });
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const invitationUrl = `${normalizedOrigin(origin)}/invite/${token}`;
  const delivery =
    deliveryMode === "EMAIL"
      ? await deliverNewInvitation(
          actor,
          invitation,
          invitationUrl,
          origin,
          client,
          options.sendEmail ?? sendCustomerInvitationEmail,
        )
      : { emailDeliveryStatus: "MANUAL_REQUIRED" as const };
  return {
    invitation: presentInvitation({
      ...invitation,
      emailDeliveryStatus: delivery.emailDeliveryStatus,
    }),
    invitationUrl,
    emailDeliveryStatus: delivery.emailDeliveryStatus,
  };
}

export async function reissueOperatorInvitation(
  actor: InvitationActor,
  invitationId: string,
  origin: string,
  client: Database = prisma,
  sendEmail: InvitationEmailSender = sendCustomerInvitationEmail,
) {
  if (!invitationId) throw new InvitationError("INVALID");
  const token = newInvitationToken();
  const tokenHash = await invitationTokenHash(token);
  const now = new Date();
  const replacement = await client.$transaction(
    async (tx) => {
      const previous = await tx.operatorInvitation.findFirst({
        where: {
          id: invitationId,
          createdByUserId: actor.userId,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      });
      if (!previous) throw new InvitationError("CONFLICT");
      const revoked = await tx.operatorInvitation.updateMany({
        where: {
          id: previous.id,
          version: previous.version,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
        },
        data: { status: "REVOKED", revokedAt: now, version: { increment: 1 } },
      });
      if (revoked.count !== 1) throw new InvitationError("CONFLICT");
      const created = await tx.operatorInvitation.create({
        data: {
          invitedEmail: previous.invitedEmail,
          ownerDisplayName: previous.ownerDisplayName,
          businessLegalName: previous.businessLegalName,
          businessDisplayName: previous.businessDisplayName,
          customerExperience: previous.customerExperience,
          tokenHash,
          createdByUserId: actor.userId,
          expiresAt: invitationExpiresAt(now),
          emailDeliveryStatus: "NOT_SENT",
        },
      });
      await tx.operatorInvitationEvent.createMany({
        data: [
          {
            invitationId: previous.id,
            actorUserId: actor.userId,
            event: "INVITATION_REISSUED",
            relatedInvitationId: created.id,
          },
          {
            invitationId: created.id,
            actorUserId: actor.userId,
            event: "INVITATION_CREATED",
            relatedInvitationId: previous.id,
          },
        ],
      });
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const invitationUrl = `${normalizedOrigin(origin)}/invite/${token}`;
  const delivery = await deliverNewInvitation(
    actor,
    replacement,
    invitationUrl,
    origin,
    client,
    sendEmail,
  );
  return {
    invitation: presentInvitation({
      ...replacement,
      emailDeliveryStatus: delivery.emailDeliveryStatus,
    }),
    invitationUrl,
    emailDeliveryStatus: delivery.emailDeliveryStatus,
  };
}

export async function listOperatorInvitations(
  actor: InvitationActor,
  client: Database = prisma,
) {
  const records = await client.operatorInvitation.findMany({
    where: { createdByUserId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return records.map(presentInvitation);
}

export async function revokeOperatorInvitation(
  actor: InvitationActor,
  invitationId: string,
  client: Database = prisma,
) {
  await client.$transaction(async (tx) => {
    const invitation = await tx.operatorInvitation.findFirst({
      where: {
        id: invitationId,
        createdByUserId: actor.userId,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
      select: { id: true, version: true },
    });
    if (!invitation) throw new InvitationError("CONFLICT");
    const result = await tx.operatorInvitation.updateMany({
      where: {
        id: invitation.id,
        version: invitation.version,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new InvitationError("CONFLICT");
    await tx.operatorInvitationEvent.create({
      data: {
        invitationId: invitation.id,
        actorUserId: actor.userId,
        event: "INVITATION_REVOKED",
      },
    });
  });
}

export async function expireOperatorInvitation(
  actor: InvitationActor,
  invitationId: string,
  client: Database = prisma,
) {
  await client.$transaction(async (tx) => {
    const invitation = await tx.operatorInvitation.findFirst({
      where: {
        id: invitationId,
        createdByUserId: actor.userId,
        status: "PENDING",
        acceptedAt: null,
      },
      select: { id: true, version: true },
    });
    if (!invitation) throw new InvitationError("CONFLICT");
    const result = await tx.operatorInvitation.updateMany({
      where: {
        id: invitation.id,
        version: invitation.version,
        status: "PENDING",
        acceptedAt: null,
      },
      data: { status: "EXPIRED", version: { increment: 1 } },
    });
    if (result.count !== 1) throw new InvitationError("CONFLICT");
    await tx.operatorInvitationEvent.create({
      data: {
        invitationId: invitation.id,
        actorUserId: actor.userId,
        event: "INVITATION_EXPIRED",
      },
    });
  });
}

export async function readInvitationByToken(
  token: string,
  client: Database = prisma,
) {
  const record = await client.operatorInvitation.findUnique({
    where: { tokenHash: await invitationTokenHash(token) },
  });
  if (!record) return null;
  const reason =
    record.acceptedAt || record.status === "ACCEPTED"
      ? "ACCEPTED"
      : record.revokedAt || record.status === "REVOKED"
        ? "REVOKED"
        : record.expiresAt <= new Date() || record.status === "EXPIRED"
          ? "EXPIRED"
          : null;
  return {
    id: record.id,
    email: record.invitedEmail,
    businessDisplayName: record.businessDisplayName,
    expiresAt: record.expiresAt,
    usable: invitationUsable(record),
    reason,
  };
}

/**
 * The conditional invitation update and every tenant foundation write share
 * one transaction. A unique deterministic business id makes concurrent
 * acceptance fail atomically rather than creating a second tenant.
 */
export async function acceptOperatorInvitation({
  token,
  userId,
  email,
  client = prisma,
}: {
  token: string;
  userId: string;
  email: string;
  client?: Database;
}) {
  const tokenHash = await invitationTokenHash(token);
  const normalizedEmail = normalizeOperatorEmail(email);
  try {
    return await client.$transaction(
      async (tx) => {
        const invitation = await tx.operatorInvitation.findUnique({
          where: { tokenHash },
        });
        if (!invitation) throw new InvitationError("NOT_FOUND");
        if (!invitationUsable(invitation))
          throw new InvitationError(
            invitation.expiresAt <= new Date() ? "EXPIRED" : "CONFLICT",
          );
        if (invitation.invitedEmail !== normalizedEmail)
          throw new InvitationError("FORBIDDEN");
        const existingMembership = await tx.businessMember.count({
          where: { userId },
        });
        if (existingMembership) throw new InvitationError("FORBIDDEN");

        const businessId = id(invitation.id, "business");
        const now = new Date();
        const accepted = await tx.operatorInvitation.updateMany({
          where: {
            id: invitation.id,
            status: "PENDING",
            version: invitation.version,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            status: "ACCEPTED",
            acceptedAt: now,
            acceptedByUserId: userId,
            provisionedBusinessId: businessId,
            version: { increment: 1 },
          },
        });
        if (accepted.count !== 1) throw new InvitationError("CONFLICT");

        await tx.business.create({
          data: {
            id: businessId,
            legalName: invitation.businessLegalName,
            displayName: invitation.businessDisplayName,
            customerExperience: invitation.customerExperience,
            taxElection: "S_CORP",
            timezone: "America/Los_Angeles",
            currency: "USD",
          },
        });
        await tx.businessMember.create({
          data: { businessId, userId, role: "OWNER" },
        });
        await tx.businessOnboarding.create({
          data: {
            businessId,
            actorUserId: userId,
            ownerDisplayName: invitation.ownerDisplayName,
            chartConfirmed: true,
            status: "IN_PROGRESS",
            cutoverDate: now,
          },
        });
        await tx.businessSettings.create({ data: { businessId } });
        await tx.businessCutover.create({
          data: {
            businessId,
            startDate: now,
            sourceReference: "Operator invitation provisioning",
          },
        });
        await Promise.all(
          workspaceAccountingFoundationOperations(tx, businessId, now),
        );
        await tx.auditEvent.create({
          data: {
            actorType: "USER",
            businessId,
            actorMembershipId: userId,
            action: "CREATE",
            entityType: "OperatorInvitationProvisioning",
            entityId: invitation.id,
            afterJson: {
              soleOwner: true,
              accountingFoundation: "COMPLETED",
              onboarding: "IN_PROGRESS",
            },
            metadataJson: {
              event: "INVITATION_ACCEPTED",
              executionMode: "operator-one-time-invitation",
              operatorUserId: invitation.createdByUserId,
            },
          },
        });
        return { businessId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof InvitationError) throw error;
    throw new InvitationError("PROVISIONING_FAILED");
  }
}

async function deliverNewInvitation(
  actor: InvitationActor,
  invitation: {
    id: string;
    invitedEmail: string;
    ownerDisplayName: string;
    businessDisplayName: string;
    expiresAt: Date;
  },
  invitationUrl: string,
  origin: string,
  client: Database,
  sendEmail: InvitationEmailSender,
) {
  const attemptedAt = new Date();
  const claimed = await client.$transaction(async (tx) => {
    const result = await tx.operatorInvitation.updateMany({
      where: {
        id: invitation.id,
        status: "PENDING",
        acceptedAt: null,
        revokedAt: null,
        emailDeliveryStatus: "NOT_SENT",
      },
      data: {
        emailDeliveryStatus: "SENDING",
        emailDeliveryAttemptedAt: attemptedAt,
        emailDeliveryError: null,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return false;
    await tx.operatorInvitationEvent.create({
      data: {
        invitationId: invitation.id,
        actorUserId: actor.userId,
        event: "INVITATION_EMAIL_SENDING",
        provider: "CLOUDFLARE_EMAIL_SERVICE",
      },
    });
    return true;
  });
  if (!claimed) throw new InvitationError("CONFLICT");

  let result: CustomerInvitationEmailResult;
  try {
    result = await sendEmail({
      recipientEmail: invitation.invitedEmail,
      ownerDisplayName: invitation.ownerDisplayName,
      businessDisplayName: invitation.businessDisplayName,
      expiresAt: invitation.expiresAt,
      invitationUrl,
      logoUrl: `${normalizedOrigin(origin)}/brand/capture-tracker-wordmark.png`,
    });
  } catch (error) {
    const failureCode =
      error instanceof CustomerInvitationEmailError
        ? error.code
        : "PROVIDER_REJECTED";
    await client.$transaction(async (tx) => {
      const updated = await tx.operatorInvitation.updateMany({
        where: {
          id: invitation.id,
          status: "PENDING",
          emailDeliveryStatus: "SENDING",
        },
        data: {
          emailDeliveryStatus: "FAILED",
          emailDeliveryError: failureCode,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new InvitationError("CONFLICT");
      await tx.operatorInvitationEvent.create({
        data: {
          invitationId: invitation.id,
          actorUserId: actor.userId,
          event: "INVITATION_EMAIL_FAILED",
          provider: "CLOUDFLARE_EMAIL_SERVICE",
          failureCode,
        },
      });
    });
    return { emailDeliveryStatus: "FAILED" as const };
  }
  await client.$transaction(async (tx) => {
    const updated = await tx.operatorInvitation.updateMany({
      where: {
        id: invitation.id,
        status: "PENDING",
        emailDeliveryStatus: "SENDING",
      },
      data: {
        emailDeliveryStatus: "SENT",
        emailDeliveryError: null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new InvitationError("CONFLICT");
    await tx.operatorInvitationEvent.create({
      data: {
        invitationId: invitation.id,
        actorUserId: actor.userId,
        event: "INVITATION_EMAIL_ACCEPTED",
        provider: result.provider,
        providerMessageId: result.messageId,
      },
    });
  });
  return { emailDeliveryStatus: "SENT" as const };
}

function normalizedOrigin(origin: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new InvitationError("INVALID");
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function presentInvitation(record: {
  id: string;
  invitedEmail: string;
  ownerDisplayName: string;
  businessLegalName: string;
  businessDisplayName: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  emailDeliveryStatus: string;
  emailDeliveryAttemptedAt: Date | null;
  emailDeliveryError: string | null;
}) {
  const expired = record.status === "PENDING" && record.expiresAt <= new Date();
  return {
    id: record.id,
    invitedEmail: record.invitedEmail,
    ownerDisplayName: record.ownerDisplayName,
    businessLegalName: record.businessLegalName,
    businessDisplayName: record.businessDisplayName,
    status: expired ? "EXPIRED" : record.status,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    acceptedAt: record.acceptedAt,
    revokedAt: record.revokedAt,
    emailDeliveryStatus: record.emailDeliveryStatus,
    emailDeliveryAttemptedAt: record.emailDeliveryAttemptedAt,
    emailDeliveryError: record.emailDeliveryError,
  };
}
