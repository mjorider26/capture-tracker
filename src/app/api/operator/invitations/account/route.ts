import { productionOwnerBootstrapAuth } from "@/lib/auth";
import { readInvitationByToken } from "@/lib/auth/operator-invitations";
import { validateProductionBootstrapInput } from "@/lib/auth/production-owner-bootstrap-core";

export const dynamic = "force-dynamic";

function isJson(request: Request) {
  return (
    request.headers.get("content-type")?.includes("application/json") ?? false
  );
}
function nativeRedirect(request: Request, token: string, code: string) {
  const destination =
    code === "ACCOUNT_CREATED" || code === "ACCOUNT_EXISTS"
      ? `/sign-in?invite=${encodeURIComponent(token)}${code === "ACCOUNT_CREATED" ? "&created=1" : ""}`
      : `/invite/${encodeURIComponent(token)}?accountError=1`;
  return Response.redirect(new URL(destination, request.url), 303);
}
function accountResult(
  request: Request,
  json: boolean,
  token: string,
  status: number,
  code: string,
) {
  if (!json) return nativeRedirect(request, token, code);
  return Response.json(
    code === "ACCOUNT_CREATED"
      ? { ok: true, code }
      : { message: "Account creation could not be completed.", code },
    { status },
  );
}
function trustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
async function created(response: unknown) {
  if (!(response instanceof Response) || !response.ok) return false;
  const body: unknown = await response.clone().json();
  return Boolean(body && typeof body === "object" && "user" in body);
}

export async function POST(request: Request) {
  const json = isJson(request);
  if (!trustedOrigin(request))
    return accountResult(request, json, "", 403, "REQUEST_REJECTED");
  let body: unknown;
  try {
    body = json
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return accountResult(request, json, "", 400, "INVALID_INPUT");
  }
  const input = validateProductionBootstrapInput(body);
  const token =
    body &&
    typeof body === "object" &&
    "token" in body &&
    typeof body.token === "string"
      ? body.token
      : "";
  if (!input || !token)
    return accountResult(request, json, token, 400, "INVALID_INPUT");
  try {
    const invitation = await readInvitationByToken(token);
    if (!invitation?.usable || invitation.email !== input.email)
      return accountResult(request, json, token, 403, "INVITATION_UNAVAILABLE");
    const authResponse = await productionOwnerBootstrapAuth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
      headers: request.headers,
      asResponse: true,
    });
    return (await created(authResponse))
      ? json
        ? Response.json({ ok: true, code: "ACCOUNT_CREATED" })
        : nativeRedirect(request, token, "ACCOUNT_CREATED")
      : accountResult(request, json, token, 409, "ACCOUNT_EXISTS");
  } catch {
    return accountResult(request, json, token, 500, "TEMPORARY_FAILURE");
  }
}
