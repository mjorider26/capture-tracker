type R2HttpMetadata = { contentType?: string };
type R2Object = { arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: R2HttpMetadata; customMetadata?: Record<string, string> };
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
    async putPending(key: string, bytes: Uint8Array, metadata: Record<string, string>) {
      await bucket.put(`pending/${key}`, bytes, { customMetadata: metadata });
    },
    async getPrivate(namespace: "active" | "quarantine", key: string) {
      return bucket.get(`${namespace}/${key}`);
    },
    async head(namespace: "pending" | "active" | "quarantine", key: string) {
      return bucket.head(`${namespace}/${key}`);
    },
    async promote(key: string, namespace: "active" | "quarantine") {
      const source = await bucket.get(`pending/${key}`);
      if (!source) throw new DocumentR2UnavailableError();
      const target = `${namespace}/${key}`;
      await bucket.put(target, await source.arrayBuffer(), { httpMetadata: source.httpMetadata, customMetadata: source.customMetadata });
      try { await bucket.delete(`pending/${key}`); } catch (error) { await bucket.delete(target); throw error; }
    },
    async compensate(namespace: "pending" | "active" | "quarantine", key: string) {
      await bucket.delete(`${namespace}/${key}`);
    },
  };
}
