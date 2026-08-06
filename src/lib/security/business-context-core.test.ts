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
      onboarding: {
        status: "COMPLETED",
      },
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
  it("denies an authenticated user with no business membership, including incomplete provisioning", async () => {
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

  it("keeps separately resolved request contexts tenant-scoped", async () => {
    const first = createMembership();
    const second = createMembership({
      id: "membership-two",
      user: { id: "other-user", email: "other@capturetracker.local", displayName: "Other owner", version: 2 },
      business: {
        id: "business-two",
        legalName: "Other Company LLC",
        displayName: "Other Company",
        timezone: "America/New_York",
        currency: "USD",
        version: 2,
        onboarding: { status: "COMPLETED" },
      },
    });

    const [firstContext, secondContext] = await Promise.all([
      resolveBusinessContext({ sessionId: "session-one", userId: first.user.id, loadMemberships: vi.fn().mockResolvedValue([first]) }),
      resolveBusinessContext({ sessionId: "session-two", userId: second.user.id, loadMemberships: vi.fn().mockResolvedValue([second]) }),
    ]);

    expect(firstContext.business.id).toBe("business-one");
    expect(secondContext.business.id).toBe("business-two");
    expect(firstContext.user.id).not.toBe(secondContext.user.id);
  });

  it("denies a membership whose workspace provisioning is incomplete", async () => {
    const membership = createMembership({
      business: {
        id: "business-one",
        legalName: "Capture Tracker Demo LLC",
        displayName: "Capture Tracker Demo",
        timezone: "America/Los_Angeles",
        currency: "USD",
        version: 1,
        onboarding: null,
      },
    });

    await expect(resolveBusinessContext({
      sessionId: "session-one",
      userId: "authenticated-user",
      loadMemberships: vi.fn().mockResolvedValue([membership]),
    })).rejects.toMatchObject({
      status: 403,
      code: "BUSINESS_ACCESS_DENIED",
    });
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
        onboarding: {
          status: "COMPLETED",
        },
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
