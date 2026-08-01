import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

// React clears cache entries at the request boundary. Layouts, pages, and
// server actions therefore share one authenticated context per request.
export const requireBusinessContext = cache(async function requireBusinessContext() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new AccessControlError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Sign in is required.",
    );
  }

  return resolveBusinessContext({
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
});
