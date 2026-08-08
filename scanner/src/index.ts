import { Container, ContainerProxy } from "@cloudflare/containers";

type TimingStage = "UPLOAD_COMPLETED" | "DOCUMENT_QUARANTINED" | "QUEUE_PRODUCED" | "QUEUE_CONSUMER_STARTED" | "SCANNER_INSTANCE_REQUESTED" | "SCANNER_READY" | "R2_FETCH_STARTED" | "R2_FETCH_COMPLETED" | "CLAMAV_SCAN_STARTED" | "CLAMAV_SCAN_COMPLETED" | "SCAN_RESULT_RECEIVED" | "ACTIVE_COPY_STARTED" | "ACTIVE_COPY_COMPLETED" | "DATABASE_FINALIZATION_STARTED" | "DATABASE_FINALIZATION_COMMITTED" | "QUARANTINE_DELETE_STARTED" | "QUARANTINE_DELETE_COMPLETED" | "QUEUE_ACKNOWLEDGED";
type ScanTrace = { correlationId: string; timings: Array<{ stage: TimingStage; at: string; durationMs?: number; result?: "CLEAN" | "INFECTED" | "FAILED" }> };
type ScanJob = { documentId: string; version: number; trace?: ScanTrace };
type QueueMessage = { body: unknown; attempts: number; ack(): void; retry(options?: { delaySeconds?: number }): void };
type QueueBatch = { messages: readonly QueueMessage[] };
type Service = { fetch(request: Request): Promise<Response> };
type ScannerStub = { fetch(request: Request): Promise<Response> };
type ScannerBinding = { getByName(name: string): ScannerStub };

type Env = {
  CAPTURE_TRACKER_APP: Service;
  CAPTURE_TRACKER_DOCUMENT_SCANNER: ScannerBinding;
  CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN: string;
};

const maxDeliveryAttempts = 4; // Initial delivery plus the Queue consumer's three bounded retries.
// Signature initialization and the first ClamAV engine load can take longer
// than a normal receipt scan. This runs in the Queue consumer (never the
// upload request), so allow a bounded two-minute cold-start window.
const scanTimeoutMs = 120_000;
const timingStages: readonly TimingStage[] = ["UPLOAD_COMPLETED", "DOCUMENT_QUARANTINED", "QUEUE_PRODUCED", "QUEUE_CONSUMER_STARTED", "SCANNER_INSTANCE_REQUESTED", "SCANNER_READY", "R2_FETCH_STARTED", "R2_FETCH_COMPLETED", "CLAMAV_SCAN_STARTED", "CLAMAV_SCAN_COMPLETED", "SCAN_RESULT_RECEIVED", "ACTIVE_COPY_STARTED", "ACTIVE_COPY_COMPLETED", "DATABASE_FINALIZATION_STARTED", "DATABASE_FINALIZATION_COMMITTED", "QUARANTINE_DELETE_STARTED", "QUARANTINE_DELETE_COMPLETED", "QUEUE_ACKNOWLEDGED"];

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForScannerReady(scanner: ScannerStub) {
  const startedAt = Date.now();
  const deadline = Date.now() + scanTimeoutMs;
  let lastReason = "UNAVAILABLE";
  let lastTrace = "";
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const response = await scanner.fetch(new Request("https://document-scanner.internal/health", { signal: AbortSignal.timeout(10_000) }));
      const health = await response.json() as { ready?: unknown; reason?: unknown; trace?: unknown };
      if (health?.ready === true) return { durationMs: Date.now() - startedAt, cold: attempts > 1 };
      if (typeof health?.reason === "string" && /^[A-Z0-9_]{1,48}$/.test(health.reason)) lastReason = health.reason;
      const trace = health?.trace && typeof health.trace === "object"
        ? Object.entries(health.trace as Record<string, unknown>)
          .filter(([key, value]) => /^[A-Z_]{1,32}$/.test(key) && (value === "PASS" || value === "FAIL" || value === "ATTEMPTED" || value === "STARTED"))
          .map(([key, value]) => `${key}:${value}`).sort().join(",")
        : "";
      if (trace && trace !== lastTrace) {
        lastTrace = trace;
        console.warn(JSON.stringify({ event: "document_scanner_startup_trace", trace }));
      }
    } catch {
      // A sleeping Container can briefly reject health requests while its
      // engine and signature database initialize. The bounded loop remains
      // fail-closed if it never becomes ready.
    }
    await delay(2_000);
  }
  throw new ScanStageError(`scanner_readiness_${lastReason}`);
}

function parseJob(input: unknown): ScanJob | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { documentId?: unknown; version?: unknown; trace?: unknown };
  if (typeof candidate.documentId !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(candidate.documentId) || typeof candidate.version !== "number" || !Number.isSafeInteger(candidate.version) || candidate.version < 1) return null;
  if (candidate.trace === undefined) return { documentId: candidate.documentId, version: candidate.version };
  if (!candidate.trace || typeof candidate.trace !== "object") return null;
  const trace = candidate.trace as { correlationId?: unknown; timings?: unknown; uploadAcceptedAt?: unknown; documentQuarantinedAt?: unknown; queueProducedAt?: unknown };
  if (typeof trace.correlationId !== "string" || !/^[a-f0-9]{32}$/.test(trace.correlationId)) return null;
  if (trace.timings === undefined) {
    const timings: ScanTrace["timings"] = [];
    const legacy: Array<[unknown, TimingStage]> = [
      [trace.uploadAcceptedAt, "UPLOAD_COMPLETED"],
      [trace.documentQuarantinedAt, "DOCUMENT_QUARANTINED"],
      [trace.queueProducedAt, "QUEUE_PRODUCED"],
    ];
    for (const [at, stage] of legacy) if (typeof at === "string") timings.push({ at, stage });
    return { documentId: candidate.documentId, version: candidate.version, trace: { correlationId: trace.correlationId, timings } };
  }
  if (!Array.isArray(trace.timings) || trace.timings.length > 24) return null;
  const timings: ScanTrace["timings"] = [];
  for (const entry of trace.timings) {
    if (!entry || typeof entry !== "object") return null;
    const timing = entry as { stage?: unknown; at?: unknown; durationMs?: unknown; result?: unknown };
    if (typeof timing.stage !== "string" || !timingStages.includes(timing.stage as TimingStage) || typeof timing.at !== "string") return null;
    if (timing.durationMs !== undefined && (typeof timing.durationMs !== "number" || !Number.isSafeInteger(timing.durationMs) || timing.durationMs < 0 || timing.durationMs > 300_000)) return null;
    if (timing.result !== undefined && timing.result !== "CLEAN" && timing.result !== "INFECTED" && timing.result !== "FAILED") return null;
    timings.push({ stage: timing.stage as TimingStage, at: timing.at, ...(typeof timing.durationMs === "number" ? { durationMs: timing.durationMs } : {}), ...(typeof timing.result === "string" ? { result: timing.result as "CLEAN" | "INFECTED" | "FAILED" } : {}) });
  }
  return { documentId: candidate.documentId, version: candidate.version, trace: { correlationId: trace.correlationId, timings } };
}

function timing(stage: TimingStage, job: ScanJob, extra: { durationMs?: number; result?: "CLEAN" | "INFECTED" | "FAILED" } = {}) {
  if (!job.trace) return;
  const at = new Date().toISOString();
  if (job.trace.timings.length < 24) job.trace.timings.push({ stage, at, ...extra });
  console.warn(JSON.stringify({ event: "document_scan_timing", stage, correlationId: job.trace.correlationId, at, ...extra }));
}

function retryDelay(attempts: number) {
  return Math.min(900, 30 * 2 ** Math.max(0, attempts - 1));
}

function internalRequest(env: Env, pathname: string, body: BodyInit) {
  return env.CAPTURE_TRACKER_APP.fetch(new Request(`https://capture-tracker.internal${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-capture-tracker-scanner-token": env.CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN },
    body,
  }));
}

class ScanStageError extends Error {
  constructor(readonly stage: string, readonly status?: number) {
    super(stage);
  }
}

async function applyResult(env: Env, job: ScanJob, category: "CLEAN" | "INFECTED" | "FAILED", scannerVersion?: string) {
  const response = await internalRequest(env, "/api/internal/document-scans/result", JSON.stringify({ job, result: { category, scannerId: "clamav", ...(scannerVersion ? { scannerVersion } : {}) } }));
  if (!response.ok) throw new Error("Internal document scan result was not accepted.");
}

async function processMessage(env: Env, message: QueueMessage) {
  const job = parseJob(message.body);
  if (!job) {
    console.warn(JSON.stringify({ event: "document_scan_stage", stage: "job_contract", outcome: "INVALID", attempt: message.attempts }));
    message.ack();
    return;
  }
  let stage = "private_content";
  const startedAt = Date.now();
  timing("QUEUE_CONSUMER_STARTED", job);
  console.warn(JSON.stringify({ event: "document_scan_stage", stage: "consumer_delivery", outcome: "STARTED", attempt: message.attempts }));
  try {
    const contentStartedAt = Date.now();
    timing("R2_FETCH_STARTED", job);
    const content = await internalRequest(env, "/api/internal/document-scans/content", JSON.stringify(job));
    if (content.status === 204) {
      console.warn(JSON.stringify({ event: "document_scan_stage", stage: "private_content", outcome: "UNAVAILABLE", attempt: message.attempts, durationMs: Date.now() - contentStartedAt }));
      message.ack();
      return;
    } // stale job, wrong version, or no longer quarantined
    if (!content.ok) throw new ScanStageError(stage, content.status);
    const bytes = await content.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) throw new ScanStageError("private_content_boundary");
    timing("R2_FETCH_COMPLETED", job, { durationMs: Date.now() - contentStartedAt });
    console.warn(JSON.stringify({ event: "document_scan_stage", stage: "private_content", outcome: "PASS", attempt: message.attempts, durationMs: Date.now() - contentStartedAt }));
    timing("SCANNER_INSTANCE_REQUESTED", job);
    const scanner = env.CAPTURE_TRACKER_DOCUMENT_SCANNER.getByName("singleton");
    stage = "scanner_readiness";
    console.warn(JSON.stringify({ event: "document_scan_stage", stage, outcome: "STARTED", attempt: message.attempts }));
    const readiness = await waitForScannerReady(scanner);
    const readinessMs = readiness.durationMs;
    console.warn(JSON.stringify({ event: "document_scan_stage", stage, outcome: "PASS", attempt: message.attempts, durationMs: readinessMs }));
    timing("SCANNER_READY", job, { durationMs: readinessMs });
    stage = "scanner_scan";
    const scanStartedAt = Date.now();
    timing("CLAMAV_SCAN_STARTED", job);
    console.warn(JSON.stringify({ event: "document_scan_stage", stage, outcome: "STARTED", attempt: message.attempts }));
    const response = await scanner.fetch(new Request("https://document-scanner.internal/scan", { method: "POST", headers: { "content-type": content.headers.get("content-type") ?? "application/octet-stream" }, body: bytes, signal: AbortSignal.timeout(45_000) }));
    if (!response.ok) throw new ScanStageError(stage, response.status);
    const result = await response.json() as { outcome?: unknown; scannerVersion?: unknown; signaturesReady?: unknown };
    const scannerVersion = typeof result.scannerVersion === "string" ? result.scannerVersion.slice(0, 80) : undefined;
    if (result.signaturesReady !== true || (result.outcome !== "CLEAN" && result.outcome !== "INFECTED")) throw new ScanStageError("scanner_result_contract");
    console.warn(JSON.stringify({ event: "document_scan_stage", stage, outcome: "PASS", attempt: message.attempts, durationMs: Date.now() - scanStartedAt }));
    timing("CLAMAV_SCAN_COMPLETED", job, { durationMs: Date.now() - scanStartedAt, result: result.outcome });
    timing("SCAN_RESULT_RECEIVED", job, { result: result.outcome });
    stage = "apply_result";
    const applyStartedAt = Date.now();
    await applyResult(env, job, result.outcome, scannerVersion);
    console.warn(JSON.stringify({ event: "document_scan_stage", stage, outcome: "PASS", attempt: message.attempts, durationMs: Date.now() - applyStartedAt }));
    message.ack();
    timing("QUEUE_ACKNOWLEDGED", job, { durationMs: Date.now() - startedAt });
    try { await internalRequest(env, "/api/internal/document-scans/timing", JSON.stringify({ job })); }
    catch { /* Telemetry is intentionally best-effort after Queue acknowledgement. */ }
    console.warn(JSON.stringify({ event: "document_scan_stage", stage: "consumer_delivery", outcome: "ACKED", attempt: message.attempts, durationMs: Date.now() - startedAt }));
  } catch (error) {
    // Queue observability intentionally records only delivery state. Document
    // identifiers, object keys, file bytes, signatures, and scanner output
    // must never enter Worker logs.
    const failedStage = error instanceof ScanStageError ? error.stage : stage;
    const status = error instanceof ScanStageError ? error.status : undefined;
    console.warn(JSON.stringify({ event: "document_scan_retry", stage: failedStage, ...(status ? { status } : {}), attempt: message.attempts, finalAttempt: message.attempts >= maxDeliveryAttempts }));
    if (message.attempts >= maxDeliveryAttempts) {
      try { await applyResult(env, job, "FAILED"); }
      catch { console.error(JSON.stringify({ event: "document_scan_failure_state_unavailable", stage: "apply_failure" })); }
    }
    message.retry({ delaySeconds: retryDelay(message.attempts) });
  }
}

export class DocumentScannerContainer extends Container {
  defaultPort = 8080;
  // Container disk is ephemeral after sleep, so a cold restart must safely
  // refresh ClamAV signatures before it can scan. Fifteen minutes keeps a
  // normal receipt session warm without pinning an instance indefinitely.
  sleepAfter = "15m";
  enableInternet = false;
  interceptHttps = true;
  allowedHosts = ["database.clamav.net", "*.clamav.net"];
  pingEndpoint = "container/health";

  onStop(params: { exitCode?: unknown; reason?: unknown }) {
    const exitCode = typeof params.exitCode === "number" && Number.isSafeInteger(params.exitCode) ? params.exitCode : undefined;
    const reason = typeof params.reason === "string" && /^[A-Z_]{1,64}$/.test(params.reason) ? params.reason : "UNAVAILABLE";
    console.warn(JSON.stringify({ event: "document_scanner_container_stopped", ...(exitCode === undefined ? {} : { exitCode }), reason }));
  }
}

export { ContainerProxy };

const scannerWorker = {
  async fetch() { return new Response(null, { status: 404 }); },
  async queue(batch: QueueBatch, env: Env) {
    for (const message of batch.messages) await processMessage(env, message);
  },
};

export default scannerWorker;
