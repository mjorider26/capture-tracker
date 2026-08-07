export type DocumentScanJob = { documentId: string; version: number };
export type DocumentScanResult =
  | { category: "CLEAN"; scannerId: string; scannerVersion?: string }
  | { category: "INFECTED"; scannerId: string; scannerVersion?: string }
  | { category: "FAILED"; scannerId: string; scannerVersion?: string };

export function parseDocumentScanJob(input: unknown): DocumentScanJob | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { documentId?: unknown; version?: unknown };
  if (typeof candidate.documentId !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(candidate.documentId) || typeof candidate.version !== "number" || !Number.isSafeInteger(candidate.version) || candidate.version < 1) return null;
  return { documentId: candidate.documentId, version: candidate.version };
}

export function parseDocumentScanResult(input: unknown): DocumentScanResult | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { category?: unknown; scannerId?: unknown; scannerVersion?: unknown };
  if ((candidate.category !== "CLEAN" && candidate.category !== "INFECTED" && candidate.category !== "FAILED") || typeof candidate.scannerId !== "string" || (candidate.scannerVersion !== undefined && typeof candidate.scannerVersion !== "string")) return null;
  return { category: candidate.category, scannerId: candidate.scannerId, ...(candidate.scannerVersion ? { scannerVersion: candidate.scannerVersion } : {}) };
}
