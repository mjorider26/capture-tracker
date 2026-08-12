import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK, type JWTPayload } from "jose";
import { plaidClient } from "./client";

type Claims = JWTPayload & { request_body_sha256?: unknown };

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export async function verifyPlaidWebhook(rawBody: string, compactJwt: string | null, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!compactJwt || compactJwt.length > 4096) return { ok: false as const, code: "MISSING_OR_INVALID_SIGNATURE" };
  try {
    const header = decodeProtectedHeader(compactJwt);
    if (header.alg !== "ES256" || typeof header.kid !== "string" || !/^[A-Za-z0-9_-]{1,191}$/u.test(header.kid)) return { ok: false as const, code: "UNSUPPORTED_SIGNATURE" };
    const { key } = await plaidClient.webhookVerificationKey(header.kid);
    if (key.alg !== "ES256" || key.kid !== header.kid || (typeof key.expired_at === "number" && key.expired_at <= nowSeconds)) return { ok: false as const, code: "INVALID_VERIFICATION_KEY" };
    const verificationKey = await importJWK(key as JWK, "ES256");
    const verified = await jwtVerify(compactJwt, verificationKey, { algorithms: ["ES256"] });
    const claims = verified.payload as Claims;
    if (typeof claims.iat !== "number" || claims.iat > nowSeconds + 30 || nowSeconds - claims.iat > 300) return { ok: false as const, code: "STALE_SIGNATURE" };
    if (typeof claims.request_body_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(claims.request_body_sha256)) return { ok: false as const, code: "INVALID_BODY_HASH" };
    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    if (!constantTimeEqual(bodyHash, claims.request_body_sha256)) return { ok: false as const, code: "BODY_HASH_MISMATCH" };
    const signatureHash = createHash("sha256").update(compactJwt).digest("hex");
    return { ok: true as const, keyId: header.kid, bodyHash, signatureHash };
  } catch { return { ok: false as const, code: "SIGNATURE_VERIFICATION_FAILED" }; }
}

export const plaidWebhookVerificationInternals = { constantTimeEqual };
