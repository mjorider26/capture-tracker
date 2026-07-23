import type { BusinessRole } from "../../generated/prisma/enums";

export type BusinessMembershipRecord = {
  id: string;
  role: BusinessRole;
  version: number;

  user: {
    id: string;
    email: string;
    displayName: string;
    version: number;
  };

  business: {
    id: string;
    legalName: string;
    displayName: string;
    timezone: string;
    currency: string;
    version: number;
  };
};

export type BusinessContext = {
  sessionId: string;
  user: BusinessMembershipRecord["user"];

  membership: {
    id: string;
    role: BusinessRole;
    version: number;
  };

  business: BusinessMembershipRecord["business"];
};

export type LoadMembershipsForUser = (
  userId: string,
) => Promise<BusinessMembershipRecord[]>;

export class AccessControlError extends Error {
  constructor(
    public readonly status: 401 | 403 | 409,
    public readonly code:
      | "AUTHENTICATION_REQUIRED"
      | "BUSINESS_ACCESS_DENIED"
      | "AMBIGUOUS_BUSINESS_CONTEXT",
    message: string,
  ) {
    super(message);
    this.name = "AccessControlError";
  }
}

export function isAccessControlError(
  error: unknown,
): error is AccessControlError {
  return error instanceof AccessControlError;
}

export async function resolveBusinessContext({
  sessionId,
  userId,
  loadMemberships,
}: {
  sessionId: string;
  userId: string;
  loadMemberships: LoadMembershipsForUser;
}): Promise<BusinessContext> {
  const memberships = await loadMemberships(userId);

  if (memberships.length === 0) {
    throw new AccessControlError(
      403,
      "BUSINESS_ACCESS_DENIED",
      "This account does not have access to a business.",
    );
  }

  if (memberships.length > 1) {
    throw new AccessControlError(
      409,
      "AMBIGUOUS_BUSINESS_CONTEXT",
      "This account has more than one business assignment.",
    );
  }

  const membership = memberships[0];

  return {
    sessionId,
    user: membership.user,
    membership: {
      id: membership.id,
      role: membership.role,
      version: membership.version,
    },
    business: membership.business,
  };
}
