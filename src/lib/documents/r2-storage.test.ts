import { describe, expect, it } from "vitest";

import { createDocumentR2Storage, DocumentR2UnavailableError, type DocumentR2Bucket } from "./r2-storage";

describe("future R2 document storage boundary", () => {
  it("fails closed when the Worker binding is absent", () => {
    expect(() => createDocumentR2Storage(undefined)).toThrow(DocumentR2UnavailableError);
  });

  it("uses private namespaces and compensates a failed promotion", async () => {
    const operations: string[] = [];
    const bucket: DocumentR2Bucket = {
      put: async (key) => { operations.push(`put:${key}`); },
      get: async (key) => key === "pending/key" ? { arrayBuffer: async () => new ArrayBuffer(1) } : null,
      head: async () => null,
      delete: async (key) => { operations.push(`delete:${key}`); if (key === "pending/key") throw new Error("temporary delete failed"); },
    };
    const storage = createDocumentR2Storage(bucket);
    await expect(storage.promote("key", "active")).rejects.toThrow("temporary delete failed");
    expect(operations).toEqual(["put:active/key", "delete:pending/key", "delete:active/key"]);
  });
});
