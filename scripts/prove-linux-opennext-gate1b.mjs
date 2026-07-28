import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { logStage, runBoundedCommand, startManagedProcess, stopManagedProcess } from "./linux-proof-lifecycle.mjs";
import { assertSanitizedReport, summarizeOutput } from "./linux-proof-report-sanitizer.mjs";
import { pollHealthContract } from "./linux-proof-health-contract.mjs";

const artifactRoot = ".open-next";
const workerPath = join(artifactRoot, "worker.js");
const assetsRoot = join(artifactRoot, "assets");
const reportPath = ".artifacts/linux-opennext-gate1b.json";
const maxCompressedWorkerBytes = 3 * 1024 * 1024;
const maxUncompressedWorkerBytes = 64 * 1024 * 1024;
const previewTimeoutMs = 90_000;
const dryRunTimeoutMs = 120_000;
const totalTimeoutMs = 12 * 60_000;
const requiredEnvironmentNames = ["BETTER_AUTH_SECRET", "CAPTURE_TRACKER_STAGING_DATABASE_URL", "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL", "CAPTURE_TRACKER_STAGING_DATABASE_NAME", "DATABASE_URL"];
const activeProcesses = new Set();

function assert(condition, message) { if (!condition) throw new Error(message); }
function sha256(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  const visit = (current) => { for (const entry of readdirSync(current, { withFileTypes: true })) { const path = join(current, entry.name); if (entry.isDirectory()) visit(path); else if (entry.isFile()) files.push(path); } };
  visit(directory);
  return files;
}
function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "CAPTURE_TRACKER_STAGING_DATABASE_URL", "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL"]) delete environment[key];
  Object.assign(environment, { CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", CI: "true", CAPTURE_TRACKER_ENVIRONMENT: "staging", CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare", CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon", CAPTURE_TRACKER_REAL_DATA_APPROVED: "false", CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false", CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false", CAPTURE_TRACKER_DATA_MODE: "fictional" });
  return environment;
}
function previewDiagnostics(managed, started) {
  return {
    childExitCode: managed.child.exitCode,
    childSignal: managed.child.signalCode,
    stdout: summarizeOutput(managed.stdout()),
    stderr: summarizeOutput(managed.stderr()),
    elapsedMs: Date.now() - started,
  };
}
async function previewWorker() {
  const port = 8791;
  logStage("workerd-preview", `starting local-only preview (timeout=${previewTimeoutMs}ms)`);
  const managed = startManagedProcess({ command: "npx", args: ["wrangler", "dev", "--local", "--config", "wrangler.jsonc", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", ".artifacts/workerd-state"], cwd: process.cwd(), env: cleanEnvironment() });
  activeProcesses.add(managed);
  const started = Date.now();
  const result = { previewResult: "fail", liveStatus: null, liveContractResult: "not-run", liveFailureCode: null, liveState: null, liveTopLevelFields: [], liveDurationMs: null, readyStatus: null, readyContractResult: "not-run", readyFailureCode: null, readyState: null, readyTopLevelFields: [], readyDurationMs: null, diagnostics: null, cleanupResult: null };
  try {
    const live = await pollHealthContract({ url: `http://127.0.0.1:${port}/api/health/live`, contractName: "live", attempts: 30, requestTimeoutMs: 1_000, intervalMs: 250, stopWhen: () => managed.child.exitCode !== null ? "PREVIEW_CHILD_EXITED" : null });
    Object.assign(result, { liveStatus: live.status, liveContractResult: live.contractResult, liveFailureCode: live.failureCode, liveState: live.state, liveTopLevelFields: live.topLevelFields, liveDurationMs: live.durationMs });
    assert(live.contractResult === "pass", `Workerd liveness contract failed (${live.failureCode}).`);
    const ready = await pollHealthContract({ url: `http://127.0.0.1:${port}/api/health/ready`, contractName: "readyFailClosed", attempts: 1, requestTimeoutMs: 1_500, intervalMs: 0, stopWhen: () => managed.child.exitCode !== null ? "PREVIEW_CHILD_EXITED" : null });
    Object.assign(result, { readyStatus: ready.status, readyContractResult: ready.contractResult, readyFailureCode: ready.failureCode, readyState: ready.state, readyTopLevelFields: ready.topLevelFields, readyDurationMs: ready.durationMs });
    assert(ready.contractResult === "pass", `Workerd fail-closed readiness contract failed (${ready.failureCode}).`);
    assert(Date.now() - started <= previewTimeoutMs, "Workerd preview exceeded its deadline.");
    result.previewResult = "pass";
  } catch (error) {
    result.previewResult = "fail";
    result.errorCode = error instanceof Error && /PREVIEW_CHILD_EXITED/.test(error.message) ? "PREVIEW_CHILD_EXITED" : "PREVIEW_HEALTH_PROOF_FAILED";
  } finally {
    const cleanup = await stopManagedProcess(managed);
    activeProcesses.delete(managed);
    result.cleanupResult = cleanup.forced ? "forced" : "clean";
    result.durationMs = Date.now() - started;
    result.diagnostics = previewDiagnostics(managed, started);
    logStage("workerd-preview", `stopped forced=${cleanup.forced}`);
  }
  return result;
}
async function dryRunWorker() {
  const result = await runBoundedCommand({ stage: "wrangler-dry-run", command: "npx", args: ["wrangler", "deploy", "--config", "wrangler.jsonc", "--dry-run", "--no-autoconfig", "--outdir", ".artifacts/wrangler-dry-run"], cwd: process.cwd(), env: cleanEnvironment(), timeoutMs: dryRunTimeoutMs });
  const totalUpload = result.output.match(/Total Upload:\s*([^\n]+)/i)?.[1] ?? null;
  return { result: result.result, exitCode: result.exitCode, signal: result.signal, totalUpload, stdout: summarizeOutput(result.stdout), stderr: summarizeOutput(result.stderr), cleanup: result.cleanup };
}
function createReport() {
  assert(process.platform === "linux", "Gate 1B proof must run on Linux.");
  assert(existsSync(workerPath), "OpenNext Worker entry is missing.");
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  assert(config.name === "capture-tracker-staging", "The reviewed Worker target name is incorrect.");
  assert(!config.routes && !config.route && !config.domains && !config.domain, "The dry-run configuration must not contain routes or custom domains.");
  const workerBytes = statSync(workerPath).size;
  const assetFiles = filesUnder(assetsRoot);
  return { schemaVersion: 2, deploymentCandidateSha: process.env.GITHUB_SHA ?? null, linux: { platform: process.platform, architecture: process.arch, nodeVersion: process.version, npmVersion: process.env.npm_config_user_agent?.match(/npm\/(\S+)/)?.[1] ?? null }, lockfileSha256: sha256("package-lock.json"), worker: { entry: "worker.js", sha256: sha256(workerPath), uncompressedBytes: workerBytes, gzipBytes: gzipSync(readFileSync(workerPath)).byteLength, fitsWorkersFree: workerBytes <= maxUncompressedWorkerBytes && gzipSync(readFileSync(workerPath)).byteLength <= maxCompressedWorkerBytes, moduleFormat: "ESM" }, staticAssets: { count: assetFiles.length, totalBytes: assetFiles.reduce((total, path) => total + statSync(path).size, 0) }, packagedRuntimeDependencyCount: filesUnder(artifactRoot).filter((path) => path.endsWith("package.json")).length, bindings: [...new Set([...(config.assets?.binding ? [config.assets.binding] : []), ...(config.services ?? []).map((service) => service.binding)])].sort(), environmentVariableNames: [...new Set([...Object.keys(config.vars ?? {}), ...requiredEnvironmentNames])].sort(), openNextConfiguration: { sha256: createHash("sha256").update(readFileSync("open-next.config.ts", "utf8")).digest("hex") }, limits: { compressedWorkerBytes: maxCompressedWorkerBytes, uncompressedWorkerBytes: maxUncompressedWorkerBytes, startupLimitMs: 1000 } };
}
async function stopAll(reason) {
  logStage("cleanup", reason);
  await Promise.allSettled([...activeProcesses].map((managed) => stopManagedProcess(managed)));
  activeProcesses.clear();
}
function writeReport(report) {
  assertSanitizedReport(report);
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
function writeValidationFailureReport(report, error) {
  const finding = error?.finding ?? { path: "report", category: "UNKNOWN", reason: "SANITIZED_OUTPUT_POLICY" };
  const safeFailure = { schemaVersion: 2, status: "failure", deploymentCandidateSha: report.deploymentCandidateSha, failedStage: "report-validation", diagnostic: { path: finding.path, category: finding.category, reason: finding.reason } };
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(safeFailure, null, 2)}\n`, "utf8");
}
function persistReport(report) {
  try { writeReport(report); } catch (error) { writeValidationFailureReport(report, error); throw error; }
}
async function main() {
  const report = createReport();
  report.status = "running";
  report.workerdPreview = await previewWorker();
  if (report.workerdPreview.previewResult !== "pass") {
    report.status = "failure";
    report.failedStage = "workerd-preview";
    persistReport(report);
    throw new Error("Workerd preview failed; safe failure evidence was recorded.");
  }
  report.wranglerDryRun = await dryRunWorker();
  if (report.wranglerDryRun.result !== "pass") {
    report.status = "failure";
    report.failedStage = "wrangler-dry-run";
    persistReport(report);
    throw new Error("Wrangler dry-run failed; safe failure evidence was recorded.");
  }
  assert(report.worker.fitsWorkersFree, "Worker artifact exceeds the Workers Free size limits.");
  report.status = "success";
  persistReport(report);
  logStage("complete", `preview=pass dry-run=pass gzip=${report.worker.gzipBytes} bytes`);
}
const totalTimer = setTimeout(() => { stopAll("total-timeout").finally(() => { console.error("Gate 1B total timeout exceeded."); process.exit(1); }); }, totalTimeoutMs);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stopAll(`received-${signal}`).finally(() => process.exit(1)); });
process.once("uncaughtException", (error) => { stopAll("uncaught-exception").finally(() => { console.error(error.message); process.exit(1); }); });
process.once("unhandledRejection", (reason) => { stopAll("unhandled-rejection").finally(() => { console.error(reason instanceof Error ? reason.message : "Unhandled rejection."); process.exit(1); }); });
main().then(() => { clearTimeout(totalTimer); process.exit(0); }).catch(async (error) => { clearTimeout(totalTimer); await stopAll("proof-failed"); console.error(error instanceof Error ? error.message : "Gate 1B Linux proof failed."); process.exit(1); });
