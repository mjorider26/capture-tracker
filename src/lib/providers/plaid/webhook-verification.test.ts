import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { plaidClient } from "./client";
import { plaidCryptoInternals } from "./crypto";
import { verifyPlaidWebhook } from "./webhook-verification";

const encodedJson = (value: unknown) => plaidCryptoInternals.base64Url(new TextEncoder().encode(JSON.stringify(value)));

describe("Plaid webhook verification", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("requires ES256, a fresh iat, the exact raw-body hash, and Plaid's current JWK", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    vi.spyOn(plaidClient, "webhookVerificationKey").mockResolvedValue({ key: { ...publicJwk, alg: "ES256", kid: "test-key", expired_at: null } });
    const rawBody = JSON.stringify({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: "item-1" });
    const now = 1_786_400_000, hash = createHash("sha256").update(rawBody).digest("hex");
    const header = encodedJson({ alg: "ES256", kid: "test-key", typ: "JWT" }), claims = encodedJson({ iat: now, request_body_sha256: hash });
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(`${header}.${claims}`)));
    const jwt = `${header}.${claims}.${plaidCryptoInternals.base64Url(signature)}`;
    await expect(verifyPlaidWebhook(rawBody, jwt, now)).resolves.toMatchObject({ ok: true, keyId: "test-key", bodyHash: hash, signatureHash: createHash("sha256").update(jwt).digest("hex") });
    await expect(verifyPlaidWebhook(`${rawBody} `, jwt, now)).resolves.toMatchObject({ ok: false, code: "BODY_HASH_MISMATCH" });
    await expect(verifyPlaidWebhook(rawBody, jwt, now + 301)).resolves.toMatchObject({ ok: false, code: "STALE_SIGNATURE" });
  });
});
