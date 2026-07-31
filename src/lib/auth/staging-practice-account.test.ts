import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  businesses: new Map<string, unknown>(),
  memberships: new Map<string, { businessId: string; userId: string; role: string }>(),
  onboarding: new Map<string, unknown>(),
  settings: new Map<string, unknown>(),
  audits: new Map<string, unknown>(),
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  businessMember: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  business: {
    upsert: vi.fn(),
  },
  businessOnboarding: {
    upsert: vi.fn(),
  },
  businessSettings: {
    upsert: vi.fn(),
  },
  auditEvent: {
    upsert: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma }));
describe("practice workspace provisioning", () => {
  beforeEach(() => {
    database.businesses.clear();
    database.memberships.clear();
    database.onboarding.clear();
    database.settings.clear();
    database.audits.clear();

    prisma.businessMember.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) =>
      [...database.memberships.values()]
        .filter((membership) => membership.userId === where.userId)
        .slice(0, 2)
        .map(({ businessId }) => ({ businessId })),
    );
    prisma.business.upsert.mockImplementation(async ({ where, create }: { where: { id: string }; create: { id: string } }) => {
      if (!database.businesses.has(where.id)) database.businesses.set(where.id, create);
    });
    prisma.businessMember.upsert.mockImplementation(async ({ where, create }: { where: { businessId_userId: { businessId: string; userId: string } }; create: { businessId: string; userId: string; role: string } }) => {
      const { businessId, userId } = where.businessId_userId;
      database.memberships.set(`${businessId}:${userId}`, create);
    });
    prisma.businessOnboarding.upsert.mockImplementation(async ({ where, create }: { where: { businessId: string }; create: { businessId: string } }) => {
      if (!database.onboarding.has(where.businessId)) database.onboarding.set(where.businessId, create);
    });
    prisma.businessSettings.upsert.mockImplementation(async ({ where, create }: { where: { businessId: string }; create: { businessId: string } }) => {
      if (!database.settings.has(where.businessId)) database.settings.set(where.businessId, create);
    });
    prisma.auditEvent.upsert.mockImplementation(async ({ where, create }: { where: { id: string }; create: { id: string } }) => {
      if (!database.audits.has(where.id)) database.audits.set(where.id, create);
    });
    prisma.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
  });

  it("provisions one business, owner membership, defaults, onboarding, and audit event atomically", async () => {
    const { provisionPracticeWorkspace } = await import("./staging-practice-account");

    await provisionPracticeWorkspace({
      userId: "identity-one",
      displayName: "Practice Owner",
    });

    expect(database.businesses.size).toBe(1);
    expect(database.memberships.size).toBe(1);
    expect(database.onboarding.size).toBe(1);
    expect(database.settings.size).toBe(1);
    expect(database.audits.size).toBe(1);
    expect([...database.memberships.values()][0]).toMatchObject({
      role: "OWNER",
      userId: "identity-one",
    });
  });

  it("does not duplicate the workspace or membership when provisioning is retried", async () => {
    const { provisionPracticeWorkspace } = await import("./staging-practice-account");
    const input = { userId: "identity-one", displayName: "Practice Owner" };

    await provisionPracticeWorkspace(input);
    await provisionPracticeWorkspace(input);

    expect(database.businesses.size).toBe(1);
    expect(database.memberships.size).toBe(1);
    expect(database.onboarding.size).toBe(1);
    expect(database.settings.size).toBe(1);
    expect(database.audits.size).toBe(1);
  });
});
