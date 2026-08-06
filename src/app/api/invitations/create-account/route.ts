import { productionOwnerBootstrapAuth } from "@/lib/auth";
import {
  acquireProductionOwnerBootstrap,
  isProductionWorkspaceReady,
  productionBootstrapCanResume,
  provisionProductionWorkspace,
} from "@/lib/auth/production-owner-bootstrap";
import {
  productionBootstrapEmailHash,
  productionBootstrapError,
  validateProductionBootstrapInput,
} from "@/lib/auth/production-owner-bootstrap-core";
import { verifyWorkerdPassword } from "@/lib/auth/workerd-password";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    production: process.env.CAPTURE_TRACKER_ENVIRONMENT === "production",
    available: await isProductionOwnerBootstrapAvailable(),
  }, { headers: { "Cache-Control": "no-store" } });
}

function failure(status = 400) {
  return Response.json({ message: productionBootstrapError }, { status });
}

function trustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function userFromResponse(response: Response) {
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("user" in payload) || !payload.user || typeof payload.user !== "object" || !("id" in payload.user) || typeof payload.user.id !== "string") return null;
  return payload.user.id;
}

function duplicateIdentity(result: unknown) {
  return result instanceof Response ? result.status === 422 : typeof result === "object" && result !== null && "statusCode" in result && result.statusCode === 422;
}

async function resumeIdentity(email: string, password: string, emailHash: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user || !(await productionBootstrapCanResume(emailHash, user.id))) return null;
  const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
  return credential?.password && await verifyWorkerdPassword(credential.password, password) ? user.id : null;
}

export async function POST(request: Request) {
  if (!trustedOrigin(request)) return failure(403);
  let body: unknown;
  try { body = await request.json(); } catch { return failure(); }
  const input = validateProductionBootstrapInput(body);
  if (!input) return failure();

  try {
    const lease = await acquireProductionOwnerBootstrap(input);
    if (!lease) return Response.json({ code: "BOOTSTRAP_CLOSED" }, { status: 403 });
    const emailHash = productionBootstrapEmailHash(input.email);
    let userId = await resumeIdentity(input.email, input.password, emailHash);
    let created = false;
    if (!userId) {
      const result: unknown = await productionOwnerBootstrapAuth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password }, headers: request.headers, asResponse: true });
      userId = result instanceof Response ? await userFromResponse(result.clone()) : null;
      created = Boolean(userId);
      if (!userId && duplicateIdentity(result)) userId = await resumeIdentity(input.email, input.password, emailHash);
    }
    if (!userId) return failure();
    if (!(await productionBootstrapCanResume(emailHash, userId))) return failure(403);
    if (!(await isProductionWorkspaceReady(userId))) await provisionProductionWorkspace({ userId, displayName: input.name, ownerEmailHash: emailHash });
    return Response.json({ ok: true, code: created ? "ACCOUNT_CREATED" : "ACCOUNT_ALREADY_READY" });
  } catch {
    return failure(500);
  }
}
