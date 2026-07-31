import { stagingPracticeAccountAuth } from "@/lib/auth";
import {
  practiceAccountError,
  validatePracticeAccountInput,
} from "@/lib/auth/staging-practice-account-core";
import {
  PracticeWorkspaceProvisionError,
  provisionPracticeWorkspace,
} from "@/lib/auth/staging-practice-account";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AuthUser = { id: string };

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
    return signInExistingIdentity({ email, password, headers });
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

  // A retry after identity creation can authenticate the same user and finish
  // the deterministic workspace provisioning without creating another record.
  // Better Auth returns its duplicate-user condition as an API-error object
  // when called in-process, rather than as a Fetch Response.
  if (!isExistingIdentityResult(signUpResult)) return null;

  return signInExistingIdentity({ email, password, headers });
}

async function signInExistingIdentity({
  email,
  password,
  headers,
}: {
  email: string;
  password: string;
  headers: Headers;
}) {
  const signInResult: unknown = await stagingPracticeAccountAuth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  if (!(signInResult instanceof Response)) return null;
  const existingUser = await userFromAuthResponse(signInResult.clone());
  return existingUser ? { response: signInResult, user: existingUser } : null;
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

    await provisionPracticeWorkspace({
      userId: identity.user.id,
      displayName: input.name,
    });

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
