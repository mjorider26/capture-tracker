import { getCloudflareContext } from "@opennextjs/cloudflare";

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
  };
}

export async function getPrivateDocumentStorage() {
  const context = await getCloudflareContext({ async: true });
  const bucket = (context.env as CloudflareEnv & { CAPTURE_TRACKER_DOCUMENTS?: DocumentR2Bucket })
    .CAPTURE_TRACKER_DOCUMENTS;
  return createDocumentR2Storage(bucket);
}
