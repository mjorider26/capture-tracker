import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workspaceFailureMetadata } from "@/lib/observability/workspace-failure";

import {
  AccessControlError,
  resolveBusinessContext,
} from "./business-context-core";

export {
  AccessControlError,
  isAccessControlError,
} from "./business-context-core";

export type {
  BusinessContext,
  BusinessMembershipRecord,
} from "./business-context-core";

export async function requireBusinessContext() {
  let session;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error(JSON.stringify(workspaceFailureMetadata("session", error)));
    throw error;
  }

  if (!session) {
    throw new AccessControlError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Sign in is required.",
    );
  }

  try {
    return await resolveBusinessContext({
      sessionId: session.session.id,
      userId: session.user.id,

      loadMemberships: async (userId) =>
        prisma.businessMember.findMany({
        where: {
          userId,
        },

        select: {
          id: true,
          role: true,
          version: true,

          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              version: true,
            },
          },

          business: {
            select: {
              id: true,
              legalName: true,
              displayName: true,
              timezone: true,
              currency: true,
              version: true,
              onboarding: {
                select: {
                  status: true,
                },
              },
            },
          },
        },

        // We need only enough results to distinguish:
        // zero, exactly one, or more than one.
        take: 2,
        }),
    });
  } catch (error) {
    if (!(error instanceof AccessControlError)) console.error(JSON.stringify(workspaceFailureMetadata("business_context", error)));
    throw error;
  }
}
