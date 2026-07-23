import { describe, expect, it, vi } from "vitest";

import {
  resolveBusinessContext,
  type BusinessMembershipRecord,
} from "./business-context-core";

function createMembership(
  overrides: Partial<BusinessMembershipRecord> = {},
): BusinessMembershipRecord {
  const base: BusinessMembershipRecord = {
    id: "membership-one",
    role: "OWNER",
    version: 1,

    user: {
      id: "authenticated-user",
      email: "owner@capturetracker.local",
      displayName: "Demo Owner",
      version: 1,
    },

    business: {
      id: "business-one",
      legalName: "Capture Tracker Demo LLC",
      displayName: "Capture Tracker Demo",
      timezone: "America/Los_Angeles",
      currency: "USD",
      version: 1,
    },
  };

  return {
    ...base,
    ...overrides,
    user: {
      ...base.user,
      ...overrides.user,
    },
    business: {
      ...base.business,
      ...overrides.business,
    },
  };
}

describe("resolveBusinessContext", () => {
  it("denies an authenticated user with no business membership", async () => {
    const loadMemberships = vi.fn().mockResolvedValue([]);

    await expect(
      resolveBusinessContext({
        sessionId: "session-one",
        userId: "authenticated-user",
        loadMemberships,
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "BUSINESS_ACCESS_DENIED",
    });

    expect(loadMemberships).toHaveBeenCalledWith(
      "authenticated-user",
    );
  });

  it("returns the single business assigned to the authenticated user", async () => {
    const membership = createMembership();

    const loadMemberships = vi
      .fn()
      .mockResolvedValue([membership]);

    const context = await resolveBusinessContext({
      sessionId: "session-one",
      userId: "authenticated-user",
      loadMemberships,
    });

    expect(context).toEqual({
      sessionId: "session-one",
      user: membership.user,
      membership: {
        id: membership.id,
        role: membership.role,
        version: membership.version,
      },
      business: membership.business,
    });

    expect(loadMemberships).toHaveBeenCalledTimes(1);
    expect(loadMemberships).toHaveBeenCalledWith(
      "authenticated-user",
    );
  });

  it("refuses to guess when a user has multiple businesses", async () => {
    const firstMembership = createMembership();

    const secondMembership = createMembership({
      id: "membership-two",
      business: {
        id: "business-two",
        legalName: "Unrelated Company LLC",
        displayName: "Unrelated Company",
        timezone: "America/New_York",
        currency: "USD",
        version: 1,
      },
    });

    const loadMemberships = vi
      .fn()
      .mockResolvedValue([
        firstMembership,
        secondMembership,
      ]);

    await expect(
      resolveBusinessContext({
        sessionId: "session-one",
        userId: "authenticated-user",
        loadMemberships,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "AMBIGUOUS_BUSINESS_CONTEXT",
    });
  });
});
