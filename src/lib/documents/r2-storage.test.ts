import { describe, expect, it } from "vitest";

import { createDocumentR2Storage, DocumentR2UnavailableError, type DocumentR2Bucket } from "./r2-storage";

describe("private R2 document storage", () => {
  it("fails closed when the Worker binding is absent", () => {
    expect(() => createDocumentR2Storage(undefined)).toThrow(DocumentR2UnavailableError);
  });

  it("uses an active-only private namespace", async () => {
    const operations: string[] = [];
    const bucket: DocumentR2Bucket = {
      put: async (key) => { operations.push(`put:${key}`); },
      get: async (key) => { operations.push(`get:${key}`); return null; },
      head: async () => null,
      delete: async (key) => { operations.push(`delete:${key}`); },
    };
    const storage = createDocumentR2Storage(bucket);
    await storage.putActive("opaque", new Uint8Array([1]), { version: "1" }, "image/png");
    await storage.getActive("opaque");
    await storage.removeActive("opaque");
    expect(operations).toEqual(["put:active/opaque", "get:active/opaque", "delete:active/opaque"]);
  });
});
