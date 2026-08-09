import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { workspaceAccountingFoundationOperations } from "@/lib/accounting/workspace-bootstrap";
import { prisma } from "@/lib/prisma";

import { invitationExpiresAt, invitationTokenHash, invitationUsable, newInvitationToken, parseOperatorInvitationInput } from "./operator-invitations-core";
import { normalizeOperatorEmail } from "./operator-authorization-core";

type Database = PrismaClient;
type InvitationActor = { userId: string; email: string; displayName: string };
const id = (invitationId: string, suffix: string) => `operator-invite-${invitationId}-${suffix}`;

export class InvitationError extends Error {
  constructor(public readonly code: "INVALID" | "NOT_FOUND" | "EXPIRED" | "FORBIDDEN" | "CONFLICT" | "PROVISIONING_FAILED") { super(code); this.name = "InvitationError"; }
}

export async function createOperatorInvitation(actor: InvitationActor, input: unknown, origin: string, client: Database = prisma) {
  const parsed = parseOperatorInvitationInput(input);
  if (!parsed) throw new InvitationError("INVALID");
  const token = newInvitationToken();
  const tokenHash = await invitationTokenHash(token);
  const invitation = await client.operatorInvitation.create({ data: { ...parsed, invitedEmail: normalizeOperatorEmail(parsed.invitedEmail), tokenHash, createdByUserId: actor.userId, expiresAt: invitationExpiresAt() } });
  return { invitation: presentInvitation(invitation), invitationUrl: `${origin}/invite/${token}` };
}

export async function listOperatorInvitations(actor: InvitationActor, client: Database = prisma) {
  const records = await client.operatorInvitation.findMany({ where: { createdByUserId: actor.userId }, orderBy: { createdAt: "desc" }, take: 100 });
  return records.map(presentInvitation);
}

export async function revokeOperatorInvitation(actor: InvitationActor, invitationId: string, client: Database = prisma) {
  const result = await client.operatorInvitation.updateMany({ where: { id: invitationId, createdByUserId: actor.userId, status: "PENDING", acceptedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: new Date(), version: { increment: 1 } } });
  if (result.count !== 1) throw new InvitationError("CONFLICT");
}

export async function expireOperatorInvitation(actor: InvitationActor, invitationId: string, client: Database = prisma) {
  const result = await client.operatorInvitation.updateMany({ where: { id: invitationId, createdByUserId: actor.userId, status: "PENDING", acceptedAt: null }, data: { status: "EXPIRED", version: { increment: 1 } } });
  if (result.count !== 1) throw new InvitationError("CONFLICT");
}

export async function readInvitationByToken(token: string, client: Database = prisma) {
  const record = await client.operatorInvitation.findUnique({ where: { tokenHash: await invitationTokenHash(token) } });
  if (!record) return null;
  return { id: record.id, email: record.invitedEmail, businessDisplayName: record.businessDisplayName, expiresAt: record.expiresAt, usable: invitationUsable(record) };
}

/**
 * The conditional invitation update and every tenant foundation write share
 * one transaction. A unique deterministic business id makes concurrent
 * acceptance fail atomically rather than creating a second tenant.
 */
export async function acceptOperatorInvitation({ token, userId, email, client = prisma }: { token: string; userId: string; email: string; client?: Database }) {
  const tokenHash = await invitationTokenHash(token);
  const normalizedEmail = normalizeOperatorEmail(email);
  try {
    return await client.$transaction(async (tx) => {
      const invitation = await tx.operatorInvitation.findUnique({ where: { tokenHash } });
      if (!invitation) throw new InvitationError("NOT_FOUND");
      if (!invitationUsable(invitation)) throw new InvitationError(invitation.expiresAt <= new Date() ? "EXPIRED" : "CONFLICT");
      if (invitation.invitedEmail !== normalizedEmail) throw new InvitationError("FORBIDDEN");
      const existingMembership = await tx.businessMember.count({ where: { userId } });
      if (existingMembership) throw new InvitationError("FORBIDDEN");

      const businessId = id(invitation.id, "business");
      const now = new Date();
      const accepted = await tx.operatorInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", version: invitation.version, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { status: "ACCEPTED", acceptedAt: now, acceptedByUserId: userId, provisionedBusinessId: businessId, version: { increment: 1 } } });
      if (accepted.count !== 1) throw new InvitationError("CONFLICT");

      await tx.business.create({ data: { id: businessId, legalName: invitation.businessLegalName, displayName: invitation.businessDisplayName, taxElection: "S_CORP", timezone: "America/Los_Angeles", currency: "USD" } });
      await tx.businessMember.create({ data: { businessId, userId, role: "OWNER" } });
      await tx.businessOnboarding.create({ data: { businessId, actorUserId: userId, ownerDisplayName: invitation.ownerDisplayName, chartConfirmed: true, status: "IN_PROGRESS", cutoverDate: now } });
      await tx.businessSettings.create({ data: { businessId } });
      await tx.businessCutover.create({ data: { businessId, startDate: now, sourceReference: "Operator invitation provisioning" } });
      await Promise.all(workspaceAccountingFoundationOperations(tx, businessId, now));
      await tx.auditEvent.create({ data: { actorType: "USER", businessId, actorMembershipId: userId, action: "CREATE", entityType: "OperatorInvitationProvisioning", entityId: invitation.id, afterJson: { soleOwner: true, accountingFoundation: "COMPLETED", onboarding: "IN_PROGRESS" }, metadataJson: { executionMode: "operator-one-time-invitation", operatorUserId: invitation.createdByUserId } } });
      return { businessId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof InvitationError) throw error;
    throw new InvitationError("PROVISIONING_FAILED");
  }
}

function presentInvitation(record: { id: string; invitedEmail: string; businessDisplayName: string; status: string; createdAt: Date; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null }) {
  const expired = record.status === "PENDING" && record.expiresAt <= new Date();
  return { id: record.id, invitedEmail: record.invitedEmail, businessDisplayName: record.businessDisplayName, status: expired ? "EXPIRED" : record.status, createdAt: record.createdAt, expiresAt: record.expiresAt, acceptedAt: record.acceptedAt, revokedAt: record.revokedAt };
}
