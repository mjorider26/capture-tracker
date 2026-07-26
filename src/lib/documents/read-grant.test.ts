import { describe, expect, it } from "vitest";

import { issueDocumentReadGrantWithSecret, verifyDocumentReadGrantWithSecret } from "./read-grant-core";

const expected = { actorUserId: "user-a", businessId: "business-a", documentId: "document-a" };
describe("private document grants", () => {
  it("binds a short-lived signed grant to its actor, business, and document", async () => {
    const secret = "test-document-grant-secret";
    const issuedAt = 1_000_000;
    const grant = await issueDocumentReadGrantWithSecret(expected, secret, issuedAt);
    await expect(verifyDocumentReadGrantWithSecret(grant, expected, secret, issuedAt + 1)).resolves.toBe(true);
    await expect(verifyDocumentReadGrantWithSecret(grant, { ...expected, documentId: "document-b" }, secret, issuedAt + 1)).resolves.toBe(false);
    await expect(verifyDocumentReadGrantWithSecret(grant, { ...expected, businessId: "business-b" }, secret, issuedAt + 1)).resolves.toBe(false);
    await expect(verifyDocumentReadGrantWithSecret(grant, { ...expected, actorUserId: "user-b" }, secret, issuedAt + 1)).resolves.toBe(false);
    await expect(verifyDocumentReadGrantWithSecret(grant, expected, secret, issuedAt + 300_001)).resolves.toBe(false);
  });

  it("rejects forged grants", async () => {
    const grant = await issueDocumentReadGrantWithSecret(expected, "test-document-grant-secret", 1_000_000);
    await expect(verifyDocumentReadGrantWithSecret(`${grant}x`, expected, "test-document-grant-secret", 1_000_001)).resolves.toBe(false);
  });
});
