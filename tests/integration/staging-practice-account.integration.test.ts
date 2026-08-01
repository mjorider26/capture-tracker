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
const incompleteEmail = `practice-incomplete-${testRunId}@capturetracker.example.test`;
const incompletePassword = `Fictional-Incomplete-${testRunId}`;
const userName = "Fictional Practice Owner";
const invitationCode = "integration-valid-invitation";

Object.assign(process.env, {
  CAPTURE_TRACKER_ENVIRONMENT: "staging",
  CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon",
  CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
  CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false",
  CAPTURE_TRACKER_DATA_MODE: "fictional",
  CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
  CAPTURE_TRACKER_STAGING_DATABASE_NAME: "capture_tracker_staging",
  CAPTURE_TRACKER_STAGING_INVITATION_CODE: invitationCode,
});

const { auth, stagingPracticeAccountAuth } = await import("../../src/lib/auth");
const { POST: publicAuthPost } = await import("../../src/app/api/auth/[...all]/route");
const { POST: practiceAccountPost } = await import("../../src/app/api/staging/create-practice-account/route");
const { createPrismaClient } = await import("../../src/lib/database/create-prisma-client");
const { resolveBusinessContext } = await import("../../src/lib/security/business-context-core");

const prisma = createPrismaClient(connectionString);

function cookieHeader(response: Response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((value) => value.split(";", 1)[0]).join("; ");
}

function practiceSignupRequest({
  emailValue = email,
  passwordValue = password,
}: {
  emailValue?: string;
  passwordValue?: string;
} = {}) {
  return new Request("http://localhost:3000/api/staging/create-practice-account", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      name: userName,
      email: emailValue,
      password: passwordValue,
      confirmPassword: passwordValue,
      invitationCode,
    }),
  });
}

async function cleanup(emailValue: string) {
  const user = await prisma.user.findUnique({ where: { email: emailValue }, select: { id: true } });
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

describe("fictional staging practice-account signup and normal sign-in", () => {
  afterAll(async () => {
    await cleanup(email);
    await cleanup(incompleteEmail);
    await prisma.$disconnect();
  });

  it("creates once without a session, provisions idempotently, and signs in normally", async () => {
    const signUp = await practiceAccountPost(practiceSignupRequest());
    expect(signUp.ok).toBe(true);
    await expect(signUp.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_CREATED" });
    expect(cookieHeader(signUp)).toBe("");

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    const [membership, onboarding, settings, audit, credential] = await Promise.all([
      prisma.businessMember.findFirst({ where: { userId: createdUser.id } }),
      prisma.businessOnboarding.findFirst({ where: { actorUserId: createdUser.id } }),
      prisma.businessSettings.findFirst({ where: { business: { members: { some: { userId: createdUser.id } } } } }),
      prisma.auditEvent.findFirst({ where: { entityType: "PracticeWorkspace", actorMembershipId: createdUser.id } }),
      prisma.account.findFirst({ where: { userId: createdUser.id, providerId: "credential" } }),
    ]);

    expect(membership?.role).toBe("OWNER");
    expect(onboarding?.status).toBe("COMPLETED");
    expect(settings).not.toBeNull();
    expect(audit?.action).toBe("CREATE");
    expect(credential).not.toBeNull();

    const duplicate = await practiceAccountPost(practiceSignupRequest());
    await expect(duplicate.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    expect(cookieHeader(duplicate)).toBe("");
    await expect(prisma.business.count({ where: { id: membership!.businessId } })).resolves.toBe(1);
    await expect(prisma.businessMember.count({ where: { userId: createdUser.id } })).resolves.toBe(1);
    await expect(prisma.businessOnboarding.count({ where: { businessId: membership!.businessId } })).resolves.toBe(1);
    await expect(prisma.auditEvent.count({ where: { id: audit!.id } })).resolves.toBe(1);

    const incompleteIdentity = await stagingPracticeAccountAuth.api.signUpEmail({
      body: { name: userName, email: incompleteEmail, password: incompletePassword },
      asResponse: true,
    });
    expect(cookieHeader(incompleteIdentity)).toBe("");
    const resumed = await practiceAccountPost(practiceSignupRequest({
      emailValue: incompleteEmail,
      passwordValue: incompletePassword,
    }));
    await expect(resumed.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    const resumedAgain = await practiceAccountPost(practiceSignupRequest({
      emailValue: incompleteEmail,
      passwordValue: incompletePassword,
    }));
    await expect(resumedAgain.json()).resolves.toEqual({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    const incompleteUser = await prisma.user.findUniqueOrThrow({ where: { email: incompleteEmail } });
    await expect(prisma.businessMember.count({ where: { userId: incompleteUser.id } })).resolves.toBe(1);

    const wrongPassword = await practiceAccountPost(practiceSignupRequest({ passwordValue: `${password}-wrong` }));
    expect(wrongPassword.status).toBe(400);
    await expect(wrongPassword.json()).resolves.toEqual({ message: "Account creation could not be completed." });

    const accessibleMembership = await prisma.businessMember.findFirstOrThrow({
      where: { userId: createdUser.id },
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
    const { createAuthClient } = await import("better-auth/react");
    const originalFetch = globalThis.fetch;
    const originalWindow = globalThis.window;
    const requests: string[] = [];
    let signOutResponse: Response | undefined;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "http://localhost:3000" } },
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: RequestInfo | URL, init?: RequestInit) => {
        const outgoing = new Request(input, init);
        requests.push(new URL(outgoing.url).pathname);
        signOutResponse = await publicAuthPost(new Request(outgoing.url, {
          method: outgoing.method,
          headers: new Headers({
            cookie: normalCookie,
            origin: "http://localhost:3000",
          }),
        }));
        return signOutResponse;
      },
    });

    const normalSignIn = await publicAuthPost(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, callbackURL: "/app/today" }),
    }));
    expect(normalSignIn.ok).toBe(true);
    const normalCookie = cookieHeader(normalSignIn);
    expect(normalCookie).not.toBe("");
    const normalSession = await auth.api.getSession({ headers: new Headers({ cookie: normalCookie }) });
    expect(normalSession?.user.id).toBe(createdUser.id);
    await expect(resolveBusinessContext({
      sessionId: normalSession!.session.id,
      userId: createdUser.id,
      loadMemberships: async () => [accessibleMembership],
    })).resolves.toMatchObject({ business: { id: membership!.businessId } });

    try {
      const browserAuthClient = createAuthClient({ basePath: "/api/auth" });
      const signOut = await browserAuthClient.signOut({
        fetchOptions: { onSuccess: () => undefined },
      });
      expect(signOut.error).toBeNull();
      expect(signOut.data).toEqual({ success: true });
    } finally {
      Object.defineProperty(globalThis, "fetch", { configurable: true, value: originalFetch });
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }

    expect(requests).toEqual(["/api/auth/sign-out"]);
    expect(signOutResponse?.ok).toBe(true);
    expect(signOutResponse?.headers.getSetCookie?.().some((value) => /Max-Age=0/i.test(value))).toBe(true);
    const repeatedSignOut = await publicAuthPost(new Request("http://localhost:3000/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }));
    expect(repeatedSignOut.ok).toBe(true);

    await expect(auth.api.getSession({
      headers: new Headers({ cookie: normalCookie }),
    })).resolves.toBeNull();

    const repeatNormalSignIn = await publicAuthPost(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, callbackURL: "/app/today" }),
    }));
    expect(repeatNormalSignIn.ok).toBe(true);
  });
});
