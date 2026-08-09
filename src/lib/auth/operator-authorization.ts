import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { isConfiguredOperator, normalizeOperatorEmail } from "./operator-authorization-core";

export { configuredOperatorEmails, isConfiguredOperator, normalizeOperatorEmail } from "./operator-authorization-core";

export type OperatorSession = { userId: string; email: string; displayName: string };

export class OperatorAuthorizationError extends Error {
  constructor() { super("Operator authorization is required."); this.name = "OperatorAuthorizationError"; }
}

/** Platform authority is allowlist-only; no business membership is consulted. */
export async function requireOperatorSession(): Promise<OperatorSession> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isConfiguredOperator(session.user.email)) throw new OperatorAuthorizationError();
  return { userId: session.user.id, email: normalizeOperatorEmail(session.user.email), displayName: session.user.name };
}

export async function requireAuthenticatedSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new OperatorAuthorizationError();
  return { userId: session.user.id, email: normalizeOperatorEmail(session.user.email), displayName: session.user.name };
}
