export type DocumentScanTrace = {
  correlationId: string;
  uploadAcceptedAt?: string;
  documentQuarantinedAt?: string;
  queueProducedAt?: string;
};

export type DocumentScanJob = { documentId: string; version: number; trace?: DocumentScanTrace };
export type DocumentScanResult =
  | { category: "CLEAN"; scannerId: string; scannerVersion?: string }
  | { category: "INFECTED"; scannerId: string; scannerVersion?: string }
  | { category: "FAILED"; scannerId: string; scannerVersion?: string };

export function parseDocumentScanJob(input: unknown): DocumentScanJob | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { documentId?: unknown; version?: unknown; trace?: unknown };
  if (typeof candidate.documentId !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(candidate.documentId) || typeof candidate.version !== "number" || !Number.isSafeInteger(candidate.version) || candidate.version < 1) return null;
  const trace = parseDocumentScanTrace(candidate.trace);
  if (candidate.trace !== undefined && !trace) return null;
  return { documentId: candidate.documentId, version: candidate.version, ...(trace ? { trace } : {}) };
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 32 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return undefined;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

export function parseDocumentScanTrace(input: unknown): DocumentScanTrace | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.correlationId !== "string" || !/^[a-f0-9]{32}$/.test(candidate.correlationId)) return null;
  const trace: DocumentScanTrace = { correlationId: candidate.correlationId };
  for (const key of ["uploadAcceptedAt", "documentQuarantinedAt", "queueProducedAt"] as const) {
    const value = safeTimestamp(candidate[key]);
    if (candidate[key] !== undefined && !value) return null;
    if (value) trace[key] = value;
  }
  return trace;
}

export function parseDocumentScanResult(input: unknown): DocumentScanResult | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { category?: unknown; scannerId?: unknown; scannerVersion?: unknown };
  if ((candidate.category !== "CLEAN" && candidate.category !== "INFECTED" && candidate.category !== "FAILED") || typeof candidate.scannerId !== "string" || (candidate.scannerVersion !== undefined && typeof candidate.scannerVersion !== "string")) return null;
  return { category: candidate.category, scannerId: candidate.scannerId, ...(candidate.scannerVersion ? { scannerVersion: candidate.scannerVersion } : {}) };
}
