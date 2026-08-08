type R2HttpMetadata = { contentType?: string };
export type R2Object = {
  arrayBuffer(): Promise<ArrayBuffer>;
  body?: ReadableStream<Uint8Array>;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
};
export type DocumentR2Bucket = {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { httpMetadata?: R2HttpMetadata; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  head(key: string): Promise<{ size: number; httpMetadata?: R2HttpMetadata; customMetadata?: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
};

export class DocumentR2UnavailableError extends Error {
  constructor() { super("The private document R2 binding is not configured."); }
}

export function createDocumentR2Storage(bucket: DocumentR2Bucket | undefined) {
  if (!bucket) throw new DocumentR2UnavailableError();
  return {
    async putActive(key: string, bytes: Uint8Array, metadata: Record<string, string>, contentType: string) {
      await bucket.put(`active/${key}`, bytes, { httpMetadata: { contentType }, customMetadata: metadata });
    },
    async getActive(key: string) {
      return bucket.get(`active/${key}`);
    },
    async removeActive(key: string) {
      await bucket.delete(`active/${key}`);
    },
    async putQuarantined(key: string, bytes: Uint8Array, metadata: Record<string, string>, contentType: string) {
      await bucket.put(`quarantine/${key}`, bytes, { httpMetadata: { contentType }, customMetadata: metadata });
    },
    async getQuarantined(key: string) {
      return bucket.get(`quarantine/${key}`);
    },
    async removeQuarantined(key: string) {
      await bucket.delete(`quarantine/${key}`);
    },
    async promoteQuarantined(key: string) {
      const object = await bucket.get(`quarantine/${key}`);
      // A previous attempt may have copied the bytes before a database
      // transaction failed. It remains unreadable while the record is
      // quarantined, and a new clean scan can safely complete that recovery.
      if (!object) {
        if (await bucket.head(`active/${key}`)) return;
        throw new Error("Quarantined document object is unavailable.");
      }
      await bucket.put(`active/${key}`, await object.arrayBuffer(), {
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      });
    },
    async finalizeQuarantinedPromotion(key: string) {
      await bucket.delete(`quarantine/${key}`);
    },
  };
}

export async function getPrivateDocumentStorage() {
  // OpenNext places the Worker request context under this stable runtime
  // symbol. Reading the binding directly avoids importing build tooling into
  // application code while still failing closed outside Worker execution.
  const context = (globalThis as typeof globalThis & {
    [key: symbol]: { env?: CloudflareEnv & { CAPTURE_TRACKER_DOCUMENTS?: DocumentR2Bucket } } | undefined;
  })[Symbol.for("__cloudflare-context__")];
  const bucket = context?.env?.CAPTURE_TRACKER_DOCUMENTS;
  return createDocumentR2Storage(bucket);
}
