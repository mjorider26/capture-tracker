import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptPlaidAccessToken, encryptPlaidAccessToken, stablePlaidClientUserId } from "./crypto";

describe("Plaid credential envelopes", () => {
  beforeEach(() => { process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); process.env.PLAID_TOKEN_KEY_VERSION = "1"; });
  it("encrypts with randomized authenticated envelopes and decrypts only at the configured version", async () => {
    const first = await encryptPlaidAccessToken("access-sandbox-test-123");
    const second = await encryptPlaidAccessToken("access-sandbox-test-123");
    expect(first.ciphertext).not.toBe(second.ciphertext);
    await expect(decryptPlaidAccessToken(first.ciphertext, first.keyVersion)).resolves.toBe("access-sandbox-test-123");
    await expect(decryptPlaidAccessToken(first.ciphertext, 2)).rejects.toThrow("key version");
  });
  it("derives stable opaque Link user identifiers without exposing tenant ids", async () => {
    const value = await stablePlaidClientUserId("business-a", "user-a");
    expect(value).toBe(await stablePlaidClientUserId("business-a", "user-a"));
    expect(value).not.toContain("business-a");
  });
});
