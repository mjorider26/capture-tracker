import "server-only";

type ScanMessage = { documentId: string; version: number };
type Queue = { send(message: ScanMessage): Promise<void> };

function queueFromWorkerContext(): Queue | undefined {
  const context = (globalThis as typeof globalThis & { [key: symbol]: { env?: { CAPTURE_TRACKER_DOCUMENT_SCAN_QUEUE?: Queue } } | undefined })[Symbol.for("__cloudflare-context__")];
  return context?.env?.CAPTURE_TRACKER_DOCUMENT_SCAN_QUEUE;
}

export async function enqueueDocumentScan(message: ScanMessage) {
  const queue = queueFromWorkerContext();
  if (!queue) throw new Error("Document scan queue is unavailable.");
  await queue.send(message);
}
