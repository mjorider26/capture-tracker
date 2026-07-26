import "server-only";

import { issueDocumentReadGrantWithSecret, verifyDocumentReadGrantWithSecret, type DocumentReadGrantInput } from "./read-grant-core";

function getSigningSecret() {
  const configured = process.env.DOCUMENT_READ_GRANT_SECRET
    ?? (process.env.NODE_ENV !== "production" ? process.env.BETTER_AUTH_SECRET : undefined);
  if (!configured) throw new Error("Private document read grants are not configured.");
  return configured;
}

export async function issueDocumentReadGrant(input: DocumentReadGrantInput, now = Date.now()) {
  return issueDocumentReadGrantWithSecret(input, getSigningSecret(), now);
}

export async function verifyDocumentReadGrant(grant: string | null, expected: DocumentReadGrantInput, now = Date.now()) {
  try { return await verifyDocumentReadGrantWithSecret(grant, expected, getSigningSecret(), now); } catch { return false; }
}
