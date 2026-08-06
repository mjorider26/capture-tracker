import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureWorkspaceAccountingFoundation } from "@/lib/accounting/workspace-bootstrap";

import { isProductionOwnerBootstrapEnabled, productionBootstrapEmailHash, type ProductionBootstrapInput } from "./production-owner-bootstrap-core";
import type { BootstrapAvailability } from "./sign-in-presentation";

const bootstrapId = "production-first-owner";
const workspaceId = "production-first-owner-workspace";
const auditId = "production-first-owner-workspace-created";

type BootstrapLease = { ownerEmailHash: string; userId: string | null };

export async function isProductionOwnerBootstrapAvailable() {
  if (!isProductionOwnerBootstrapEnabled()) return false;
  const [users, businesses] = await prisma.$transaction([
    prisma.user.count(),
    prisma.business.count(),
  ]);
  return users === 0 && businesses === 0;
}

export async function readProductionBootstrapAvailability(): Promise<BootstrapAvailability> {
  if (!isProductionOwnerBootstrapEnabled()) return "initialized";
  try {
    return await isProductionOwnerBootstrapAvailable() ? "available" : "initialized";
  } catch {
    // This is only public presentation guidance. The signup route retains the
    // authoritative locked transaction/recheck and must remain the boundary.
    return "unknown";
  }
}

export async function acquireProductionOwnerBootstrap(input: ProductionBootstrapInput): Promise<BootstrapLease | null> {
  if (!isProductionOwnerBootstrapEnabled()) return null;
  const ownerEmailHash = productionBootstrapEmailHash(input.email);
  const existing = await prisma.productionBootstrap.findUnique({ where: { id: bootstrapId }, select: { ownerEmailHash: true, userId: true } });
  if (existing) return existing.ownerEmailHash === ownerEmailHash ? existing : null;
  if (!(await isProductionOwnerBootstrapAvailable())) return null;
  try {
    const lease = await prisma.productionBootstrap.create({ data: { id: bootstrapId, ownerEmailHash } });
    return { ownerEmailHash: lease.ownerEmailHash, userId: lease.userId };
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    const concurrentLease = await prisma.productionBootstrap.findUnique({ where: { id: bootstrapId }, select: { ownerEmailHash: true, userId: true } });
    return concurrentLease?.ownerEmailHash === ownerEmailHash ? concurrentLease : null;
  }
}

export async function recordProductionBootstrapIdentity(ownerEmailHash: string, userId: string) {
  const updated = await prisma.productionBootstrap.updateMany({
    where: { id: bootstrapId, ownerEmailHash, OR: [{ userId: null }, { userId }] },
    data: { userId },
  });
  return updated.count === 1;
}

export async function productionBootstrapCanResume(ownerEmailHash: string, userId: string) {
  const lease = await prisma.productionBootstrap.findUnique({ where: { id: bootstrapId }, select: { ownerEmailHash: true, userId: true } });
  return lease?.ownerEmailHash === ownerEmailHash && (!lease.userId || lease.userId === userId);
}

export async function isProductionWorkspaceReady(userId: string) {
  const [business, membership, onboarding, settings, audit, ledgerAccounts] = await Promise.all([
    prisma.business.findUnique({ where: { id: workspaceId }, select: { id: true } }),
    prisma.businessMember.findUnique({ where: { businessId_userId: { businessId: workspaceId, userId } }, select: { role: true } }),
    prisma.businessOnboarding.findUnique({ where: { businessId: workspaceId }, select: { actorUserId: true, status: true } }),
    prisma.businessSettings.findUnique({ where: { businessId: workspaceId }, select: { id: true } }),
    prisma.auditEvent.findUnique({ where: { id: auditId }, select: { actorMembershipId: true, entityType: true } }),
    prisma.ledgerAccount.count({ where: { businessId: workspaceId, isSystem: true } }),
  ]);
  return Boolean(business && membership?.role === "OWNER" && onboarding?.actorUserId === userId && onboarding.status === "COMPLETED" && settings && audit?.actorMembershipId === userId && audit.entityType === "ProductionWorkspace" && ledgerAccounts >= 6);
}

export async function provisionProductionWorkspace({ userId, displayName, ownerEmailHash }: { userId: string; displayName: string; ownerEmailHash: string }) {
  if (!(await recordProductionBootstrapIdentity(ownerEmailHash, userId))) throw new Error("PRODUCTION_BOOTSTRAP_OWNER_REFUSED");
  const businessName = `${displayName}'s Capture Tracker workspace`;
  await prisma.$transaction([
    prisma.business.upsert({ where: { id: workspaceId }, create: { id: workspaceId, legalName: businessName, displayName: businessName, timezone: "America/Los_Angeles", currency: "USD" }, update: {} }),
    prisma.businessMember.upsert({ where: { businessId_userId: { businessId: workspaceId, userId } }, create: { businessId: workspaceId, userId, role: "OWNER" }, update: {} }),
    prisma.businessOnboarding.upsert({ where: { businessId: workspaceId }, create: { businessId: workspaceId, actorUserId: userId, ownerDisplayName: displayName, chartConfirmed: true, status: "COMPLETED", completedAt: new Date() }, update: {} }),
    prisma.businessSettings.upsert({ where: { businessId: workspaceId }, create: { businessId: workspaceId }, update: {} }),
    prisma.auditEvent.upsert({ where: { id: auditId }, create: { id: auditId, actorType: "USER", businessId: workspaceId, actorMembershipId: userId, action: "CREATE", entityType: "ProductionWorkspace", entityId: workspaceId, afterJson: { provisioning: "COMPLETED" }, metadataJson: { executionMode: "production-first-owner-bootstrap" } }, update: {} }),
  ]);
  await ensureWorkspaceAccountingFoundation(workspaceId);
}
