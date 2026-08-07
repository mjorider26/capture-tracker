import { Container, ContainerProxy } from "@cloudflare/containers";

type ScanJob = { documentId: string; version: number };
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

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForScannerReady(scanner: ScannerStub) {
  const deadline = Date.now() + scanTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await scanner.fetch(new Request("https://document-scanner.internal/health", { signal: AbortSignal.timeout(10_000) }));
      const health = response.ok ? await response.json() as { ready?: unknown } : null;
      if (health?.ready === true) return;
    } catch {
      // A sleeping Container can briefly reject health requests while its
      // engine and signature database initialize. The bounded loop remains
      // fail-closed if it never becomes ready.
    }
    await delay(2_000);
  }
  throw new Error("Scanner readiness timed out.");
}

function parseJob(input: unknown): ScanJob | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as { documentId?: unknown; version?: unknown };
  if (typeof candidate.documentId !== "string" || !/^[A-Za-z0-9_-]{1,191}$/.test(candidate.documentId) || typeof candidate.version !== "number" || !Number.isSafeInteger(candidate.version) || candidate.version < 1) return null;
  return { documentId: candidate.documentId, version: candidate.version };
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

async function applyResult(env: Env, job: ScanJob, category: "CLEAN" | "INFECTED" | "FAILED", scannerVersion?: string) {
  const response = await internalRequest(env, "/api/internal/document-scans/result", JSON.stringify({ job, result: { category, scannerId: "clamav", ...(scannerVersion ? { scannerVersion } : {}) } }));
  if (!response.ok) throw new Error("Internal document scan result was not accepted.");
}

async function processMessage(env: Env, message: QueueMessage) {
  const job = parseJob(message.body);
  if (!job) { message.ack(); return; }
  try {
    const content = await internalRequest(env, "/api/internal/document-scans/content", JSON.stringify(job));
     if (content.status === 204) { message.ack(); return; } // stale job, wrong version, or no longer quarantined
    if (!content.ok) throw new Error("Private scan content is unavailable.");
    const bytes = await content.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > 10 * 1024 * 1024) throw new Error("Private scan content exceeded the scanner boundary.");
    const scanner = env.CAPTURE_TRACKER_DOCUMENT_SCANNER.getByName("singleton");
    await waitForScannerReady(scanner);
    const response = await scanner.fetch(new Request("https://document-scanner.internal/scan", { method: "POST", headers: { "content-type": content.headers.get("content-type") ?? "application/octet-stream" }, body: bytes, signal: AbortSignal.timeout(45_000) }));
    if (!response.ok) throw new Error("Scanner did not produce a usable result.");
    const result = await response.json() as { outcome?: unknown; scannerVersion?: unknown; signaturesReady?: unknown };
    const scannerVersion = typeof result.scannerVersion === "string" ? result.scannerVersion.slice(0, 80) : undefined;
    if (result.signaturesReady !== true || (result.outcome !== "CLEAN" && result.outcome !== "INFECTED")) throw new Error("Scanner readiness or result is invalid.");
    await applyResult(env, job, result.outcome, scannerVersion);
    message.ack();
  } catch {
    // Queue observability intentionally records only delivery state. Document
    // identifiers, object keys, file bytes, signatures, and scanner output
    // must never enter Worker logs.
    console.warn(JSON.stringify({ event: "document_scan_retry", attempt: message.attempts, finalAttempt: message.attempts >= maxDeliveryAttempts }));
    if (message.attempts >= maxDeliveryAttempts) await applyResult(env, job, "FAILED");
    message.retry({ delaySeconds: retryDelay(message.attempts) });
  }
}

export class DocumentScannerContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
  enableInternet = false;
  interceptHttps = true;
  allowedHosts = ["database.clamav.net", "*.clamav.net"];
  pingEndpoint = "container/health";
}

export { ContainerProxy };

const scannerWorker = {
  async fetch() { return new Response(null, { status: 404 }); },
  async queue(batch: QueueBatch, env: Env) {
    for (const message of batch.messages) await processMessage(env, message);
  },
};

export default scannerWorker;
