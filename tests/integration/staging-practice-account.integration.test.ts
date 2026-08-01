import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

config({ path: ".env.test.local", override: false });

const connectionString = process.env.TEST_DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL is not configured in .env.test.local.");
}

process.env.DATABASE_URL = connectionString;
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "integration-fictional-only-secret";

const testRunId = randomUUID();
const email = `practice-signup-${testRunId}@capturetracker.example.test`;
const password = `Fictional-${testRunId}-Only`;
const userName = "Fictional Practice Owner";

const { auth, stagingPracticeAccountAuth } = await import("../../src/lib/auth");
const { POST: publicAuthPost } = await import("../../src/app/api/auth/[...all]/route");
const { createPrismaClient } = await import("../../src/lib/database/create-prisma-client");
const { provisionPracticeWorkspace } = await import("../../src/lib/auth/staging-practice-account");
const { validatePracticeAccountInput } = await import("../../src/lib/auth/staging-practice-account-core");
const { resolveBusinessContext } = await import("../../src/lib/security/business-context-core");

const prisma = createPrismaClient(connectionString);

function cookieHeader(response: Response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((value) => value.split(";", 1)[0]).join("; ");
}

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const memberships = await prisma.businessMember.findMany({
    where: { userId: user.id },
    select: { businessId: true },
  });
  const businessIds = memberships.map((membership) => membership.businessId);

  if (businessIds.length) {
    await prisma.auditEvent.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.businessOnboarding.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.businessSettings.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: businessIds } } });
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  }

  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

describe("fictional staging practice-account valid signup", () => {
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates, provisions, signs out, and signs in again through the normal auth instance", async () => {
    const accepted = await validatePracticeAccountInput({
      name: userName,
      email,
      password,
      confirmPassword: password,
      invitationCode: "integration-valid-invitation",
    }, {
      CAPTURE_TRACKER_ENVIRONMENT: "staging",
      CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare",
      CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon",
      CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
      CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false",
      CAPTURE_TRACKER_DATA_MODE: "fictional",
      CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
      CAPTURE_TRACKER_STAGING_DATABASE_URL: "postgresql://fixture:fixture@capture-tracker-staging-pooler.us-east-1.aws.neon.tech/capture_tracker_staging?sslmode=require",
      CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: "postgresql://fixture:fixture@capture-tracker-staging.us-east-1.aws.neon.tech/capture_tracker_staging?sslmode=require",
      CAPTURE_TRACKER_STAGING_DATABASE_NAME: "capture_tracker_staging",
      CAPTURE_TRACKER_STAGING_INVITATION_CODE: "integration-valid-invitation",
    });
    expect(accepted).not.toBeNull();

    const signUp = await stagingPracticeAccountAuth.api.signUpEmail({
      body: { name: userName, email, password },
      asResponse: true,
    });
    expect(signUp.ok).toBe(true);
    const cookie = cookieHeader(signUp);
    expect(cookie).not.toBe("");

    const payload = await signUp.clone().json() as { user: { id: string } };
    await provisionPracticeWorkspace({ userId: payload.user.id, displayName: userName });
    await provisionPracticeWorkspace({ userId: payload.user.id, displayName: userName });

    const [membership, onboarding, settings, audit, session] = await Promise.all([
      prisma.businessMember.findFirst({ where: { userId: payload.user.id } }),
      prisma.businessOnboarding.findFirst({ where: { actorUserId: payload.user.id } }),
      prisma.businessSettings.findFirst({ where: { business: { members: { some: { userId: payload.user.id } } } } }),
      prisma.auditEvent.findFirst({ where: { entityType: "PracticeWorkspace", actorMembershipId: payload.user.id } }),
      stagingPracticeAccountAuth.api.getSession({ headers: new Headers({ cookie }) }),
    ]);

    expect(membership?.role).toBe("OWNER");
    expect(onboarding?.status).toBe("COMPLETED");
    expect(settings).not.toBeNull();
    expect(audit?.action).toBe("CREATE");
    expect(session?.user.id).toBe(payload.user.id);

    const accessibleMembership = await prisma.businessMember.findFirstOrThrow({
      where: { userId: payload.user.id },
      select: {
        id: true,
        role: true,
        version: true,
        user: { select: { id: true, email: true, displayName: true, version: true } },
        business: {
          select: {
            id: true,
            legalName: true,
            displayName: true,
            timezone: true,
            currency: true,
            version: true,
            onboarding: { select: { status: true } },
          },
        },
      },
    });
    await expect(resolveBusinessContext({
      sessionId: session!.session.id,
      userId: payload.user.id,
      loadMemberships: async () => [accessibleMembership],
    })).resolves.toMatchObject({ business: { id: membership!.businessId } });

    const signOut = await stagingPracticeAccountAuth.api.signOut({
      headers: new Headers({ cookie }),
      asResponse: true,
    });
    expect(signOut.ok).toBe(true);
    await expect(stagingPracticeAccountAuth.api.getSession({
      headers: new Headers({ cookie }),
    })).resolves.toBeNull();

    const normalSignIn = await publicAuthPost(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, callbackURL: "/app/today" }),
    }));
    expect(normalSignIn.ok).toBe(true);
    const normalCookie = cookieHeader(normalSignIn);
    expect(normalCookie).not.toBe("");
    await expect(auth.api.getSession({
      headers: new Headers({ cookie: normalCookie }),
    })).resolves.toMatchObject({ user: { id: payload.user.id } });
  });
});
