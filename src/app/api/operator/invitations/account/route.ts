import { productionOwnerBootstrapAuth } from "@/lib/auth";
import { readInvitationByToken } from "@/lib/auth/operator-invitations";
import { validateProductionBootstrapInput } from "@/lib/auth/production-owner-bootstrap-core";

export const dynamic = "force-dynamic";

function failure(status = 400) { return Response.json({ message: "Account creation could not be completed." }, { status }); }
function trustedOrigin(request: Request) { const origin = request.headers.get("origin"); if (!origin) return true; try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; } }
async function created(response: unknown) { if (!(response instanceof Response) || !response.ok) return false; const body: unknown = await response.clone().json(); return Boolean(body && typeof body === "object" && "user" in body); }

export async function POST(request: Request) {
  if (!trustedOrigin(request)) return failure(403);
  let body: unknown; try { body = await request.json(); } catch { return failure(); }
  const input = validateProductionBootstrapInput(body);
  const token = body && typeof body === "object" && "token" in body && typeof body.token === "string" ? body.token : "";
  if (!input || !token) return failure();
  try {
    const invitation = await readInvitationByToken(token);
    if (!invitation?.usable || invitation.email !== input.email) return failure(403);
    const result = await productionOwnerBootstrapAuth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password }, headers: request.headers, asResponse: true });
    return await created(result) ? Response.json({ ok: true, code: "ACCOUNT_CREATED" }) : failure(409);
  } catch { return failure(500); }
}
