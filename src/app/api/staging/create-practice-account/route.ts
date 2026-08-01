import { stagingPracticeAccountAuth } from "@/lib/auth";
import {
  practiceAccountError,
  validatePracticeAccountInput,
} from "@/lib/auth/staging-practice-account-core";
import {
  isPracticeWorkspaceReady,
  PracticeWorkspaceProvisionError,
  provisionPracticeWorkspace,
} from "@/lib/auth/staging-practice-account";
import { verifyWorkerdPassword } from "@/lib/auth/workerd-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuthUser = { id: string };
type ExistingIdentity = AuthUser & { ready: boolean };

function genericError(status = 400) {
  return Response.json({ message: practiceAccountError }, { status });
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function userFromAuthResponse(response: Response): Promise<AuthUser | null> {
  if (!response.ok) return null;

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("user" in payload) ||
    !payload.user ||
    typeof payload.user !== "object" ||
    !("id" in payload.user) ||
    typeof payload.user.id !== "string"
  ) {
    return null;
  }

  return { id: payload.user.id };
}

function isExistingIdentityResult(result: unknown) {
  return (
    result instanceof Response
      ? result.status === 422
      : typeof result === "object" &&
        result !== null &&
        "statusCode" in result &&
        result.statusCode === 422
  );
}

async function createOrResumeIdentity({
  name,
  email,
  password,
  headers,
}: {
  name: string;
  email: string;
  password: string;
  headers: Headers;
}) {
  const existingIdentity = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingIdentity) {
    return resumeExistingIdentity({
      userId: existingIdentity.id,
      password,
    });
  }

  const signUpResult: unknown = await stagingPracticeAccountAuth.api.signUpEmail({
    body: { name, email, password },
    headers,
    asResponse: true,
  });

  if (signUpResult instanceof Response) {
    const createdUser = await userFromAuthResponse(signUpResult.clone());
    if (createdUser) return { response: signUpResult, user: createdUser };
  }

  // A retry after identity creation must not create a session. It validates the
  // submitted credential and resumes deterministic provisioning only when it
  // is incomplete.
  if (!isExistingIdentityResult(signUpResult)) return null;

  const duplicateIdentity = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!duplicateIdentity) return null;
  return resumeExistingIdentity({ userId: duplicateIdentity.id, password });
}

async function resumeExistingIdentity({
  userId,
  password,
}: {
  userId: string;
  password: string;
}): Promise<ExistingIdentity | null> {
  const credential = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  if (!credential?.password || !(await verifyWorkerdPassword(credential.password, password))) {
    return null;
  }

  return { id: userId, ready: await isPracticeWorkspaceReady(userId) };
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return genericError(403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericError();
  }

  const input = await validatePracticeAccountInput(body);
  if (!input) return genericError();

  try {
    const identity = await createOrResumeIdentity({
      name: input.name,
      email: input.email,
      password: input.password,
      headers: request.headers,
    });
    if (!identity) return genericError();

    if ("ready" in identity) {
      if (!identity.ready) {
        await provisionPracticeWorkspace({ userId: identity.id, displayName: input.name });
      }
      return Response.json({ ok: true, code: "ACCOUNT_ALREADY_READY" });
    }

    await provisionPracticeWorkspace({ userId: identity.user.id, displayName: input.name });

    const headers = new Headers();
    const setCookies = identity.response.headers.getSetCookie?.() ?? [];
    for (const value of setCookies) headers.append("set-cookie", value);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof PracticeWorkspaceProvisionError) {
      return genericError(503);
    }
    return genericError(500);
  }
}
