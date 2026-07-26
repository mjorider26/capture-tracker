import { describe, expect, it } from "vitest";
import { calculateDocumentRetentionUntil, canTransitionDocument, documentMetadataSchema, normalizeDocumentFilename } from "./core";

describe("documents foundation", () => {
  it("normalizes synthetic hashes and enforces metadata bounds", () => {
    expect(documentMetadataSchema.safeParse({ originalFilename: "demo.pdf", displayName: "Demo", mimeType: "application/pdf", sizeBytes: 1024, sha256: "A".repeat(64), category: "RECEIPT" }).success).toBe(true);
    expect(documentMetadataSchema.safeParse({ originalFilename: "demo.pdf", displayName: "Demo", mimeType: "text/plain", sizeBytes: 0, sha256: "bad", category: "RECEIPT" }).success).toBe(false);
  });
  it("rejects paths and keeps terminal states terminal", () => {
    expect(() => normalizeDocumentFilename("../unsafe.pdf")).toThrow();
    expect(canTransitionDocument("PENDING_VALIDATION", "ACTIVE")).toBe(true);
    expect(canTransitionDocument("ACTIVE", "QUARANTINED")).toBe(false);
  });
  it("calculates a deterministic seven-year retention target", () => {
    expect(calculateDocumentRetentionUntil(new Date("2026-07-01T12:00:00.000Z")).toISOString()).toBe("2033-07-01T12:00:00.000Z");
  });
});
