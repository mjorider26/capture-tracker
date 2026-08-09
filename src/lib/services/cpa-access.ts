import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient;
type Actor = { businessId: string; userId: string; membershipId: string; role: "OWNER" | "ADVISOR" | "CPA_READ_ONLY" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const email = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 320 ? value.trim().toLowerCase() : null;
const owner = (actor: Actor) => actor.role === "OWNER";
const audit = (actor: Actor, entityType: string, entityId: string, action: "CREATE" | "UPDATE" | "VOID", afterJson: Prisma.InputJsonValue) => ({ actorType: "USER" as const, businessId: actor.businessId, actorMembershipId: actor.membershipId, action, entityType, entityId, afterJson, metadataJson: { v2_2: true, cpaAccess: true } });

export async function createCpaInvitation(client: Db, actor: Actor, rawEmail: unknown, origin: string) {
  if (!owner(actor)) return { ok: false as const, message: "Only the business owner can invite a CPA." };
  const invitedEmail = email(rawEmail); if (!invitedEmail) return { ok: false as const, message: "Enter a valid CPA email address." };
  const token = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  const invitation = await client.$transaction(async (tx) => {
    await tx.cpaInvitation.updateMany({ where: { businessId: actor.businessId, invitedEmail, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
    const created = await tx.cpaInvitation.create({ data: { businessId: actor.businessId, invitedEmail, tokenHash: hash(token), expiresAt, createdByUserId: actor.userId } });
    await tx.auditEvent.create({ data: audit(actor, "CpaInvitation", created.id, "CREATE", { invitedEmail, expiresAt: expiresAt.toISOString(), emailDelivery: "NOT_CONFIGURED" }) }); return created;
  });
  return { ok: true as const, id: invitation.id, invitationUrl: `${origin}/cpa-invite/${token}`, expiresAt };
}
export async function revokeCpaInvitation(client: Db, actor: Actor, invitationId: string) {
  if (!owner(actor)) return false;
  return client.$transaction(async (tx) => { const result = await tx.cpaInvitation.updateMany({ where: { id: invitationId, businessId: actor.businessId, status: "PENDING", acceptedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: new Date() } }); if (result.count) await tx.auditEvent.create({ data: audit(actor, "CpaInvitation", invitationId, "VOID", { revoked: true }) }); return result.count === 1; });
}
export async function setCpaDocumentAccess(client: Db, actor: Actor, enabled: boolean) {
  if (!owner(actor)) return false;
  await client.$transaction(async (tx) => { await tx.business.update({ where: { id: actor.businessId }, data: { cpaDocumentAccess: enabled, version: { increment: 1 } } }); await tx.auditEvent.create({ data: audit(actor, "Business", actor.businessId, "UPDATE", { cpaDocumentAccess: enabled }) }); }); return true;
}
export async function readCpaInvitation(client: Db, token: string) { const invitation = await client.cpaInvitation.findUnique({ where: { tokenHash: hash(token) }, include: { business: { select: { displayName: true } } } }); if (!invitation) return null; return { email: invitation.invitedEmail, businessName: invitation.business.displayName, usable: invitation.status === "PENDING" && invitation.expiresAt > new Date() && !invitation.revokedAt && !invitation.acceptedAt }; }
export async function acceptCpaInvitation(client: Db, input: { token: string; userId: string; email: string }) {
  const tokenHash = hash(input.token); const invitedEmail = email(input.email); if (!invitedEmail) return { ok: false as const, message: "The invitation cannot be accepted safely." };
  return client.$transaction(async (tx) => { const invitation = await tx.cpaInvitation.findUnique({ where: { tokenHash } }); if (!invitation || invitation.invitedEmail !== invitedEmail || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || invitation.revokedAt || invitation.acceptedAt) return { ok: false as const, message: "This CPA invitation is unavailable." };
    const accepted = await tx.cpaInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByUserId: input.userId } }); if (!accepted.count) return { ok: false as const, message: "This CPA invitation is unavailable." };
    await tx.businessMember.upsert({ where: { businessId_userId: { businessId: invitation.businessId, userId: input.userId } }, create: { businessId: invitation.businessId, userId: input.userId, role: "CPA_READ_ONLY" }, update: { role: "CPA_READ_ONLY", version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: invitation.businessId, actorMembershipId: null, action: "CREATE", entityType: "CpaAccess", entityId: invitation.id, afterJson: { acceptedByUserId: input.userId, role: "CPA_READ_ONLY" }, metadataJson: { v2_2: true } } }); return { ok: true as const, businessId: invitation.businessId };
  });
}
export async function revokeCpaAccess(client: Db, actor: Actor, membershipId: string) {
  if (!owner(actor)) return false;
  return client.$transaction(async (tx) => { const membership = await tx.businessMember.findFirst({ where: { id: membershipId, businessId: actor.businessId, role: "CPA_READ_ONLY" }, select: { id: true } }); if (!membership) return false; await tx.businessMember.delete({ where: { id: membership.id } }); await tx.auditEvent.create({ data: audit(actor, "CpaAccess", membership.id, "VOID", { revoked: true }) }); return true; });
}
