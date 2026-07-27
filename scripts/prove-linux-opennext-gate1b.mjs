import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const artifactRoot = ".open-next";
const workerPath = join(artifactRoot, "worker.js");
const assetsRoot = join(artifactRoot, "assets");
const reportPath = ".artifacts/linux-opennext-gate1b.json";
const maxCompressedWorkerBytes = 3 * 1024 * 1024;
const maxUncompressedWorkerBytes = 64 * 1024 * 1024;
const forbidden = /(?:postgres(?:ql)?:\/\/|(?:api|access)[_-]?key\s*[=:]|password\s*[=:]|token\s*[=:]|secret\s*[=:]|[A-Z]:\\|\/(?:home|Users|tmp)\/)/i;
const requiredEnvironmentNames = [
  "BETTER_AUTH_SECRET",
  "CAPTURE_TRACKER_STAGING_DATABASE_URL",
  "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL",
  "CAPTURE_TRACKER_STAGING_DATABASE_NAME",
  "DATABASE_URL",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(directory);
  return files;
}

function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "CAPTURE_TRACKER_STAGING_DATABASE_URL", "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL"]) delete environment[key];
  environment.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";
  environment.CAPTURE_TRACKER_ENVIRONMENT = "staging";
  environment.CAPTURE_TRACKER_EXECUTION_CONTEXT = "cloudflare";
  environment.CAPTURE_TRACKER_DEPLOYMENT_PROFILE = "free-preview-cloudflare-neon";
  environment.CAPTURE_TRACKER_REAL_DATA_APPROVED = "false";
  environment.CAPTURE_TRACKER_PAID_SERVICE_APPROVED = "false";
  environment.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED = "false";
  environment.CAPTURE_TRACKER_DATA_MODE = "fictional";
  return environment;
}

function safeOutput(value) {
  return forbidden.test(value) ? "redacted-output" : value.slice(0, 500);
}

async function previewWorker() {
  const port = 8791;
  const child = spawn("npx", ["wrangler", "dev", "--local", "--config", "wrangler.jsonc", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", ".artifacts/workerd-state"], {
    cwd: process.cwd(),
    env: cleanEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const started = Date.now();
  const deadline = started + 45_000;
  let liveStatus = null;
  let readyStatus = null;
  try {
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("Workerd preview exited before it became ready.");
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health/live`);
        liveStatus = response.status;
        if (liveStatus === 200) {
          readyStatus = (await fetch(`http://127.0.0.1:${port}/api/health/ready`)).status;
          break;
        }
      } catch { /* Workerd has not finished starting. */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(liveStatus === 200, "Workerd preview did not return a successful liveness response.");
    assert(readyStatus === 503, "Workerd preview did not fail closed when its database binding was intentionally absent.");
    return { result: "pass", durationMs: Date.now() - started, liveStatus, readyStatus, output: safeOutput(output) };
  } catch (error) {
    return { result: "fail", durationMs: Date.now() - started, liveStatus, readyStatus, output: safeOutput(output), error: error instanceof Error ? error.message : "Workerd preview failed." };
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
}

function dryRunWorker() {
  const result = spawnSync("npx", ["wrangler", "deploy", "--config", "wrangler.jsonc", "--dry-run", "--no-autoconfig", "--outdir", ".artifacts/wrangler-dry-run"], {
    cwd: process.cwd(),
    env: cleanEnvironment(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const totalUpload = output.match(/Total Upload:\s*([^\n]+)/i)?.[1] ?? null;
  return {
    result: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    totalUpload,
    output: safeOutput(output),
  };
}

function createReport() {
  assert(process.platform === "linux", "Gate 1B proof must run on Linux.");
  assert(existsSync(workerPath), "OpenNext Worker entry is missing.");
  const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
  assert(config.name === "capture-tracker-staging", "The reviewed Worker target name is incorrect.");
  assert(!config.routes && !config.route && !config.domains && !config.domain, "The dry-run configuration must not contain routes or custom domains.");
  const workerBytes = statSync(workerPath).size;
  const compressedWorkerBytes = gzipSync(readFileSync(workerPath)).byteLength;
  const assetFiles = filesUnder(assetsRoot);
  const packageManifests = filesUnder(artifactRoot).filter((path) => path.endsWith("package.json"));
  const configText = readFileSync("open-next.config.ts", "utf8");
  return {
    schemaVersion: 1,
    deploymentCandidateSha: process.env.GITHUB_SHA ?? null,
    linux: { platform: process.platform, architecture: process.arch, nodeVersion: process.version, npmVersion: process.env.npm_config_user_agent?.match(/npm\/(\S+)/)?.[1] ?? null },
    lockfileSha256: sha256("package-lock.json"),
    worker: {
      entry: "worker.js",
      sha256: sha256(workerPath),
      uncompressedBytes: workerBytes,
      gzipBytes: compressedWorkerBytes,
      fitsWorkersFree: workerBytes <= maxUncompressedWorkerBytes && compressedWorkerBytes <= maxCompressedWorkerBytes,
      moduleFormat: "ESM",
    },
    staticAssets: { count: assetFiles.length, totalBytes: assetFiles.reduce((total, path) => total + statSync(path).size, 0) },
    packagedRuntimeDependencyCount: packageManifests.length,
    bindings: [...new Set([...(config.assets?.binding ? [config.assets.binding] : []), ...(config.services ?? []).map((service) => service.binding)])].sort(),
    environmentVariableNames: [...new Set([...Object.keys(config.vars ?? {}), ...requiredEnvironmentNames])].sort(),
    openNextConfiguration: { sha256: createHash("sha256").update(configText).digest("hex") },
    limits: { compressedWorkerBytes: maxCompressedWorkerBytes, uncompressedWorkerBytes: maxUncompressedWorkerBytes, startupLimitMs: 1000 },
  };
}

async function main() {
  const report = createReport();
  report.workerdPreview = await previewWorker();
  report.wranglerDryRun = dryRunWorker();
  const serialized = JSON.stringify(report);
  assert(!forbidden.test(serialized), "Gate 1B report contains a prohibited value.");
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`LINUX OPENNEXT GATE 1B: preview=${report.workerdPreview.result}; dry-run=${report.wranglerDryRun.result}; gzip=${report.worker.gzipBytes} bytes.`);
  if (!report.worker.fitsWorkersFree || report.workerdPreview.result !== "pass" || report.wranglerDryRun.result !== "pass") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Gate 1B Linux proof failed.");
  process.exitCode = 1;
});
