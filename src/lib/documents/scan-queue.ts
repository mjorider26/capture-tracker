import "server-only";

import type { DocumentScanJob } from "./scan-contract";

type Queue = { send(message: DocumentScanJob): Promise<void> };

function queueFromWorkerContext(): Queue | undefined {
  const context = (globalThis as typeof globalThis & { [key: symbol]: { env?: { CAPTURE_TRACKER_DOCUMENT_SCAN_QUEUE?: Queue } } | undefined })[Symbol.for("__cloudflare-context__")];
  return context?.env?.CAPTURE_TRACKER_DOCUMENT_SCAN_QUEUE;
}

export async function enqueueDocumentScan(message: DocumentScanJob) {
  const queue = queueFromWorkerContext();
  if (!queue) throw new Error("Document scan queue is unavailable.");
  await queue.send(message);
}
