import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { practiceBusinessId } from "./staging-practice-account-core";

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

  try {
    await prisma.$transaction(
      async (tx) => {
        const memberships = await tx.businessMember.findMany({
          where: { userId },
          select: { businessId: true },
          take: 2,
        });

        if (
          memberships.some((membership) => membership.businessId !== businessId)
        ) {
          throw new PracticeWorkspaceProvisionError();
        }

        const businessName = practiceBusinessName(displayName);
        await tx.business.upsert({
          where: { id: businessId },
          create: {
            id: businessId,
            legalName: businessName,
            displayName: businessName,
            timezone: "America/Los_Angeles",
            currency: "USD",
          },
          update: {},
        });

        await tx.businessMember.upsert({
          where: {
            businessId_userId: { businessId, userId },
          },
          create: { businessId, userId, role: "OWNER" },
          update: {},
        });

        await tx.businessOnboarding.upsert({
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
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof PracticeWorkspaceProvisionError) throw error;
    throw new PracticeWorkspaceProvisionError();
  }
}
