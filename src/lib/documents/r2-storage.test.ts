import { describe, expect, it } from "vitest";

import { createDocumentR2Storage, DocumentR2UnavailableError, type DocumentR2Bucket } from "./r2-storage";

describe("private R2 document storage", () => {
  it("fails closed when the Worker binding is absent", () => {
    expect(() => createDocumentR2Storage(undefined)).toThrow(DocumentR2UnavailableError);
  });

  it("keeps quarantined bytes separate from active private bytes and promotes without changing content", async () => {
    const operations: string[] = [];
    const contents = new Map<string, Uint8Array>();
    const bucket: DocumentR2Bucket = {
      put: async (key, value) => { operations.push(`put:${key}`); contents.set(key, new Uint8Array(value)); },
      get: async (key) => {
        operations.push(`get:${key}`);
        const value = contents.get(key);
        return value ? { arrayBuffer: async () => value.slice().buffer, httpMetadata: { contentType: "image/png" }, customMetadata: { version: "1" } } : null;
      },
      head: async () => null,
      delete: async (key) => { operations.push(`delete:${key}`); contents.delete(key); },
    };
    const storage = createDocumentR2Storage(bucket);
    await storage.putQuarantined("opaque", new Uint8Array([1]), { version: "1" }, "image/png");
    await storage.getQuarantined("opaque");
    await storage.promoteQuarantined("opaque");
    await storage.getActive("opaque");
    expect(operations).toEqual(["put:quarantine/opaque", "get:quarantine/opaque", "get:quarantine/opaque", "put:active/opaque", "delete:quarantine/opaque", "get:active/opaque"]);
    expect([...contents.keys()]).toEqual(["active/opaque"]);
    expect([...contents.get("active/opaque") ?? []]).toEqual([1]);
  });
});
