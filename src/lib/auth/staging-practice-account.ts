import "server-only";

import { prisma } from "@/lib/prisma";

import {
  practiceBusinessId,
  practiceWorkspaceAuditId,
} from "./staging-practice-account-core";

export class PracticeWorkspaceProvisionError extends Error {
  constructor() {
    super("Practice workspace provisioning failed.");
    this.name = "PracticeWorkspaceProvisionError";
  }
}

function practiceBusinessName(name: string) {
  return `${name}'s fictional practice business`;
}

export async function provisionPracticeWorkspace({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const businessId = practiceBusinessId(userId);
  const auditId = practiceWorkspaceAuditId(userId);

  try {
    const memberships = await prisma.businessMember.findMany({
      where: { userId },
      select: { businessId: true },
      take: 2,
    });

    if (memberships.some((membership) => membership.businessId !== businessId)) {
      throw new PracticeWorkspaceProvisionError();
    }

    const businessName = practiceBusinessName(displayName);
    // The Neon HTTP adapter supports batch transactions but not Prisma's
    // callback/interactive form. Every write uses a deterministic key, so a
    // retry is both atomic and duplicate-safe in Workerd.
    await prisma.$transaction([
      prisma.business.upsert({
        where: { id: businessId },
        create: {
          id: businessId,
          legalName: businessName,
          displayName: businessName,
          timezone: "America/Los_Angeles",
          currency: "USD",
        },
        update: {},
      }),
      prisma.businessMember.upsert({
        where: { businessId_userId: { businessId, userId } },
        create: { businessId, userId, role: "OWNER" },
        update: {},
      }),
      prisma.businessOnboarding.upsert({
        where: { businessId },
        create: {
          businessId,
          actorUserId: userId,
          ownerDisplayName: displayName,
          fictionalAcknowledged: true,
          chartConfirmed: true,
          status: "COMPLETED",
          completedAt: new Date(),
        },
        update: {},
      }),
      prisma.businessSettings.upsert({
        where: { businessId },
        create: { businessId },
        update: {},
      }),
      prisma.auditEvent.upsert({
        where: { id: auditId },
        create: {
          id: auditId,
          actorType: "USER",
          businessId,
          actorMembershipId: userId,
          action: "CREATE",
          entityType: "PracticeWorkspace",
          entityId: businessId,
          afterJson: { provisioning: "COMPLETED" },
          metadataJson: { executionMode: "fictional-staging-invitation" },
        },
        update: {},
      }),
    ]);
  } catch (error) {
    if (error instanceof PracticeWorkspaceProvisionError) throw error;
    throw new PracticeWorkspaceProvisionError();
  }
}
