export const documentScanTimingStages = [
  "UPLOAD_COMPLETED", "DOCUMENT_QUARANTINED", "QUEUE_PRODUCED", "QUEUE_CONSUMER_STARTED", "SCANNER_INSTANCE_REQUESTED", "SCANNER_READY", "R2_FETCH_STARTED", "R2_FETCH_COMPLETED", "CLAMAV_SCAN_STARTED", "CLAMAV_SCAN_COMPLETED", "SCAN_RESULT_RECEIVED", "ACTIVE_COPY_STARTED", "ACTIVE_COPY_COMPLETED", "DATABASE_FINALIZATION_STARTED", "DATABASE_FINALIZATION_COMMITTED", "QUARANTINE_DELETE_STARTED", "QUARANTINE_DELETE_COMPLETED", "QUEUE_ACKNOWLEDGED",
] as const;
export type DocumentScanTimingStage = typeof documentScanTimingStages[number];

export type DocumentScanTiming = { stage: DocumentScanTimingStage; at: string; durationMs?: number; result?: "CLEAN" | "INFECTED" | "FAILED" };

export type DocumentScanTrace = {
  correlationId: string;
  timings: DocumentScanTiming[];
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
  // Accept a short-lived rolling-deploy compatibility shape. No new jobs are
  // created in this format, but an already-delivered Queue message must never
  // be turned into a failed scan merely because its telemetry was upgraded.
  if (candidate.timings === undefined) {
    const legacyStages = [
      ["uploadAcceptedAt", "UPLOAD_COMPLETED"],
      ["documentQuarantinedAt", "DOCUMENT_QUARANTINED"],
      ["queueProducedAt", "QUEUE_PRODUCED"],
    ] as const;
    const timings: DocumentScanTiming[] = [];
    for (const [key, stage] of legacyStages) {
      const at = safeTimestamp(candidate[key]);
      if (candidate[key] !== undefined && !at) return null;
      if (at) timings.push({ stage, at });
    }
    return { correlationId: candidate.correlationId, timings };
  }
  if (!Array.isArray(candidate.timings) || candidate.timings.length > 24) return null;
  const timings: DocumentScanTiming[] = [];
  for (const timing of candidate.timings) {
    if (!timing || typeof timing !== "object") return null;
    const value = timing as Record<string, unknown>;
    if (typeof value.stage !== "string" || !documentScanTimingStages.includes(value.stage as DocumentScanTimingStage)) return null;
    const at = safeTimestamp(value.at);
    if (!at) return null;
    if (value.durationMs !== undefined && (typeof value.durationMs !== "number" || !Number.isSafeInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > 300_000)) return null;
    if (value.result !== undefined && value.result !== "CLEAN" && value.result !== "INFECTED" && value.result !== "FAILED") return null;
    timings.push({ stage: value.stage as DocumentScanTimingStage, at, ...(typeof value.durationMs === "number" ? { durationMs: value.durationMs } : {}), ...(typeof value.result === "string" ? { result: value.result as "CLEAN" | "INFECTED" | "FAILED" } : {}) });
  }
  return { correlationId: candidate.correlationId, timings };
}

export function appendDocumentScanTiming(trace: DocumentScanTrace | undefined, stage: DocumentScanTimingStage, options: Omit<DocumentScanTiming, "stage" | "at"> = {}) {
  if (!trace || trace.timings.length >= 24) return trace;
  trace.timings.push({ stage, at: new Date().toISOString(), ...options });
  return trace;
}

export function parseDocumentScanResult(input: unknown): DocumentScanResult | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { category?: unknown; scannerId?: unknown; scannerVersion?: unknown };
  if ((candidate.category !== "CLEAN" && candidate.category !== "INFECTED" && candidate.category !== "FAILED") || typeof candidate.scannerId !== "string" || (candidate.scannerVersion !== undefined && typeof candidate.scannerVersion !== "string")) return null;
  return { category: candidate.category, scannerId: candidate.scannerId, ...(candidate.scannerVersion ? { scannerVersion: candidate.scannerVersion } : {}) };
}
