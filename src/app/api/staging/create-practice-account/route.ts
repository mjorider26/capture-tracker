import { stagingPracticeAccountAuth } from "@/lib/auth";
import {
  practiceAccountError,
  validatePracticeAccountInput,
} from "@/lib/auth/staging-practice-account-core";
import {
  PracticeWorkspaceProvisionError,
  provisionPracticeWorkspace,
} from "@/lib/auth/staging-practice-account";

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
  const signUpResponse = await stagingPracticeAccountAuth.api.signUpEmail({
    body: { name, email, password },
    headers,
    asResponse: true,
  });

  const createdUser = await userFromAuthResponse(signUpResponse.clone());
  if (createdUser) return { response: signUpResponse, user: createdUser };

  // A retry after identity creation can authenticate the same user and finish
  // the deterministic workspace provisioning without creating another record.
  if (signUpResponse.status !== 422) return null;

  const signInResponse = await stagingPracticeAccountAuth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  const existingUser = await userFromAuthResponse(signInResponse.clone());
  return existingUser ? { response: signInResponse, user: existingUser } : null;
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
