import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const reportPath = ".artifacts/runtime-audit-report.json";
const inventoryPath = ".artifacts/cloud-worker-inventory.json";
const prohibited = /(?:postgres(?:ql)?:\/\/|(?:api|access)[_-]?key\s*[=:]|password\s*[=:]|token\s*[=:]|secret\s*[=:]|[A-Z]:\\|\/(?:home|Users|tmp)\/)/i;
const runtimeWithoutTarget = new Set(["next", "@prisma/client", "@prisma/adapter-pg", "better-auth", "@better-auth/prisma-adapter"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function command() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
function runNpm(args) {
  const options = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
  if (process.platform !== "win32") return spawnSync(command(), args, options);
  return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command(), ...args], options);
}
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function hasAuditSchema(value) {
  return Boolean(value && typeof value === "object" && Number.isInteger(value.auditReportVersion) && value.metadata?.vulnerabilities && value.vulnerabilities && typeof value.vulnerabilities === "object");
}
function extractJsonObjects(output) {
  const objects = [];
  for (let start = output.indexOf("{"); start >= 0; start = output.indexOf("{", start + 1)) {
    let depth = 0;
    let quote = false;
    let escaped = false;
    for (let index = start; index < output.length; index += 1) {
      const character = output[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quote = false;
        continue;
      }
      if (character === '"') quote = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          try { objects.push(JSON.parse(output.slice(start, index + 1))); } catch { /* Continue searching for a complete JSON object. */ }
          break;
        }
      }
    }
  }
  return objects;
}
function unavailableAuditResponse(values) {
  return /(?:EAI_AGAIN|ECONNREFUSED|ENETUNREACH|ENOTFOUND|ETIMEDOUT|EAUDIT|audit (?:endpoint|service).*(?:unavailable|failed)|registry.*unavailable)/i.test(values.filter(Boolean).join("\n"));
}
function errorObject(value) {
  return value?.error && typeof value.error === "object" && !Array.isArray(value.error) ? value.error : null;
}
function responseSchema(value, fallback = "unexpected-npm-schema-version") {
  if (hasAuditSchema(value)) return "standard-npm-audit-report";
  const error = errorObject(value);
  if (!error) return fallback;
  const status = [error.statusCode, error.status, error.code].find((candidate) => Number.isInteger(candidate));
  const description = [error.code, error.summary, error.detail, error.message].filter((candidate) => typeof candidate === "string").join("\n");
  if ([401, 403].includes(status) || /(?:E401|E403|unauthori[sz]ed|forbidden|authentication|authorization)/i.test(description)) return "authentication-or-authorization-error";
  if (status === 429 || /(?:E429|rate.?limit|too many requests)/i.test(description)) return "rate-limit-response";
  if (/(?:proxy|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|ENOTFOUND|ETIMEDOUT)/i.test(description)) return "proxy-or-network-response";
  if (/(?:registry|service|EAUDIT|unavailable)/i.test(description)) return "registry-or-service-error-payload";
  return "npm-audit-error-object";
}
function captureDiagnostics(value, { stdout, stderr, exitCode, registryHostname, fallbackSchema }) {
  const error = errorObject(value);
  const status = error && [error.statusCode, error.status, error.code].find((candidate) => Number.isInteger(candidate));
  return {
    topLevelKeys: value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).slice(0, 20) : [],
    auditReportVersionPresent: Number.isInteger(value?.auditReportVersion),
    metadataPresent: Boolean(value?.metadata),
    vulnerabilitiesPresent: Object.hasOwn(value ?? {}, "vulnerabilities"),
    vulnerabilitiesType: value?.vulnerabilities === undefined ? "absent" : Array.isArray(value.vulnerabilities) ? "array" : typeof value.vulnerabilities,
    error: {
      present: Boolean(error),
      code: error?.code ?? null,
      summary: error?.summary ?? error?.message ?? null,
      detail: error?.detail ?? null,
      statusCode: status ?? null,
    },
    responseSchema: responseSchema(value, fallbackSchema),
    stdoutBytes: Buffer.byteLength(String(stdout)),
    stderrBytes: Buffer.byteLength(String(stderr)),
    npmExitCode: Number.isInteger(exitCode) ? exitCode : null,
    registryHostname,
  };
}
function noJsonDiagnostics({ stdout, stderr, exitCode, registryHostname, responseSchema: schema }) {
  return {
    topLevelKeys: [], auditReportVersionPresent: false, metadataPresent: false, vulnerabilitiesPresent: false, vulnerabilitiesType: "absent",
    error: { present: false, code: null, summary: null, detail: null, statusCode: null },
    responseSchema: schema, stdoutBytes: Buffer.byteLength(String(stdout)), stderrBytes: Buffer.byteLength(String(stderr)), npmExitCode: Number.isInteger(exitCode) ? exitCode : null, registryHostname,
  };
}
export function parseAuditCommandResult({ stdout = "", stderr = "", exitCode = 0, spawnError = null, registryHostname = null }) {
  const candidates = extractJsonObjects(String(stdout));
  const payload = candidates.find(hasAuditSchema);
  if (payload) return { endpointStatus: "available", captureResult: "valid-audit-json", payload, diagnostics: captureDiagnostics(payload, { stdout, stderr, exitCode, registryHostname }) };
  const candidate = candidates.find((value) => errorObject(value)) ?? candidates.at(-1) ?? null;
  if (candidate) {
    const diagnostics = captureDiagnostics(candidate, { stdout, stderr, exitCode, registryHostname });
    const unavailable = diagnostics.responseSchema !== "unexpected-npm-schema-version";
    return { endpointStatus: unavailable ? "unavailable" : "malformed", captureResult: unavailable ? "audit-error-json" : "json-without-audit-schema", payload: null, diagnostics };
  }
  if (unavailableAuditResponse([stdout, stderr, spawnError])) return { endpointStatus: "unavailable", captureResult: "audit-service-unavailable", payload: null, diagnostics: noJsonDiagnostics({ stdout, stderr, exitCode, registryHostname, responseSchema: "proxy-or-network-response" }) };
  if (String(stdout).trim()) return { endpointStatus: "malformed", captureResult: "no-complete-json-on-stdout", payload: null, diagnostics: noJsonDiagnostics({ stdout, stderr, exitCode, registryHostname, responseSchema: "unexpected-npm-schema-version" }) };
  if (spawnError || exitCode !== 0 || String(stderr).trim()) return { endpointStatus: "unavailable", captureResult: "audit-command-no-json-response", payload: null, diagnostics: noJsonDiagnostics({ stdout, stderr, exitCode, registryHostname, responseSchema: "proxy-or-network-response" }) };
  return { endpointStatus: "malformed", captureResult: "empty-audit-response", payload: null, diagnostics: noJsonDiagnostics({ stdout, stderr, exitCode, registryHostname, responseSchema: "unexpected-npm-schema-version" }) };
}
function sanitized(value, state) {
  if (typeof value !== "string") return value;
  if (!prohibited.test(value)) return value;
  state.redactions += 1;
  return "[redacted]";
}
function sanitizedDiagnostic(value, state) {
  if (typeof value !== "string") return value;
  const withoutUrls = value.replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]").replace(/(?:authorization|cookie)\s*[:=]\s*(?:bearer\s+)?\S+/gi, "[redacted-header]").slice(0, 500);
  if (withoutUrls !== value) state.redactions += 1;
  return sanitized(withoutUrls, state);
}
function sanitizedDiagnostics(diagnostics, state) {
  const sensitiveKey = /(?:token|cookie|authorization|password|secret)/i;
  const safeCode = typeof diagnostics?.error?.code === "string" && /^(?:[A-Z][A-Z0-9_-]{0,39}|\d{3})$/.test(diagnostics.error.code) ? diagnostics.error.code : null;
  return {
    topLevelKeys: (diagnostics?.topLevelKeys ?? []).map((key) => sensitiveKey.test(key) ? "[sensitive-key]" : String(key).slice(0, 80)),
    auditReportVersionPresent: Boolean(diagnostics?.auditReportVersionPresent),
    metadataPresent: Boolean(diagnostics?.metadataPresent),
    vulnerabilitiesPresent: Boolean(diagnostics?.vulnerabilitiesPresent),
    vulnerabilitiesType: diagnostics?.vulnerabilitiesType ?? "absent",
    error: {
      present: Boolean(diagnostics?.error?.present), code: safeCode,
      summary: sanitizedDiagnostic(diagnostics?.error?.summary, state), detail: sanitizedDiagnostic(diagnostics?.error?.detail, state),
      statusCode: Number.isInteger(diagnostics?.error?.statusCode) && diagnostics.error.statusCode >= 100 && diagnostics.error.statusCode <= 599 ? diagnostics.error.statusCode : null,
    },
    responseSchema: diagnostics?.responseSchema ?? "unexpected-npm-schema-version",
    stdoutBytes: Number.isInteger(diagnostics?.stdoutBytes) ? diagnostics.stdoutBytes : null,
    stderrBytes: Number.isInteger(diagnostics?.stderrBytes) ? diagnostics.stderrBytes : null,
    npmExitCode: Number.isInteger(diagnostics?.npmExitCode) ? diagnostics.npmExitCode : null,
    registryHostname: typeof diagnostics?.registryHostname === "string" && /^[a-z0-9.-]+$/i.test(diagnostics.registryHostname) ? diagnostics.registryHostname.toLowerCase() : null,
  };
}
function advisoryId(via) {
  if (Number.isInteger(via.source)) return `NPM-AUDIT-${via.source}`;
  const candidates = [via.url, via.source, via.name].filter((value) => typeof value === "string");
  for (const value of candidates) {
    const match = value.match(/GHSA-[\w-]+/i);
    if (match) return match[0].toUpperCase();
  }
  return null;
}
function advisoryIdsForFinding(packageName, vulnerabilities, visited = new Set()) {
  if (visited.has(packageName)) return [];
  visited.add(packageName);
  const finding = vulnerabilities[packageName];
  if (!finding || typeof finding !== "object") return [];
  const identifiers = [];
  for (const via of finding.via ?? []) {
    if (typeof via === "object" && via !== null) {
      const identifier = advisoryId(via);
      if (identifier) identifiers.push(identifier);
    } else if (typeof via === "string") {
      identifiers.push(...advisoryIdsForFinding(via, vulnerabilities, visited));
    }
  }
  return [...new Set(identifiers)].sort();
}
function fixSummary(fix, state) {
  if (!fix) return { available: false, package: null, version: null, breaking: false };
  if (fix === true) return { available: true, package: null, version: null, breaking: false };
  if (typeof fix !== "object") return { available: Boolean(fix), package: null, version: null, breaking: false };
  return {
    available: true,
    package: sanitized(fix.name ?? null, state),
    version: sanitized(fix.version ?? null, state),
    breaking: Boolean(fix.isSemVerMajor),
  };
}
export function classifyPackage(packageName, inventory) {
  const item = inventory.packages.find((entry) => entry.package === packageName || (entry.package === "@img/*" && packageName.startsWith("@img/")));
  if (item) {
    if (item.classification === "unresolved" || item.requestTimeReachability === "unresolved") return "unresolved";
    if (item.requestTimeReachability === "reachable") return "request-time reachable Worker runtime";
    if (item.classification === "conditional runtime package" || item.classification === "copied runtime package" || item.classification === "bundled in Worker executable code") return "present in Worker but not request-time reachable";
    return "absent from deployed artifact";
  }
  if (runtimeWithoutTarget.has(packageName)) return "server/runtime dependency outside the Worker entry path";
  return "absent from deployed artifact";
}
export function createRuntimeAuditReport({ payload, endpointStatus, captureResult, diagnostics, inventory, now = new Date(), nodeVersion = process.version, npmVersion = "unknown", lockfileVersion = null, lockfileClean = true }) {
  const state = { redactions: 0 };
  const base = {
    schemaVersion: 2,
    generatedAtUtc: now.toISOString(),
    nodeVersion: sanitized(nodeVersion, state),
    npmVersion: sanitized(npmVersion, state),
    lockfileVersion,
    command: "npm audit --omit=dev --json",
    lockfileClean,
    diagnostics: sanitizedDiagnostics(diagnostics, state),
  };
  const status = endpointStatus ?? (payload === null ? "unavailable" : "available");
  if (status === "unavailable") return { ...base, endpointStatus: "unavailable", captureResult: captureResult ?? "audit-service-unavailable", totals: null, advisories: [], sanitizationDetected: state.redactions > 0, releaseGate: "blocked-audit-unavailable" };
  if (status === "malformed" || !hasAuditSchema(payload)) {
    return { ...base, endpointStatus: "malformed", captureResult: captureResult ?? "json-without-audit-schema", totals: null, advisories: [], sanitizationDetected: state.redactions > 0, releaseGate: "blocked-audit-malformed" };
  }
  assert(inventory?.schemaVersion === 1 && inventory.reportSanitized === true && Array.isArray(inventory.packages), "Sanitized Worker inventory is missing or invalid.");
  const advisories = Object.entries(payload.vulnerabilities).map(([packageName, finding]) => {
    const advisoryIds = advisoryIdsForFinding(packageName, payload.vulnerabilities);
    assert(advisoryIds.length > 0, `Audit finding is missing an advisory identifier: ${packageName}.`);
    const viaPackages = (finding.via ?? []).map((via) => typeof via === "string" ? via : via.name).filter(Boolean).map((value) => sanitized(String(value), state));
    const classification = classifyPackage(packageName, inventory);
    const severity = sanitized(finding.severity ?? "unknown", state);
    return {
      package: sanitized(packageName, state),
      severity,
      direct: Boolean(finding.isDirect),
      vulnerableRange: sanitized(finding.range ?? null, state),
      advisoryIds: [...new Set(advisoryIds)].sort(),
      dependencyChain: [...new Set(viaPackages)].sort(),
      fix: fixSummary(finding.fixAvailable, state),
      runtimeClassification: classification,
      workerArtifactClassification: inventory.packages.find((entry) => entry.package === packageName)?.classification ?? "not-in-target-inventory",
      applicationExposure: classification === "request-time reachable Worker runtime" ? "request-time" : classification === "unresolved" ? "unresolved" : "not-request-time",
      releaseGateEffect: classification === "unresolved" ? "block-unresolved-runtime" : (["high", "critical"].includes(severity) && classification === "request-time reachable Worker runtime") ? "block-reachable-high" : "non-runtime-or-non-high",
    };
  }).sort((left, right) => left.package.localeCompare(right.package));
  const report = {
    ...base,
    endpointStatus: "available",
    captureResult: captureResult ?? "valid-audit-json",
    totals: payload.metadata.vulnerabilities,
    advisories,
    sanitizationDetected: state.redactions > 0,
    releaseGate: advisories.some((entry) => entry.releaseGateEffect !== "non-runtime-or-non-high") ? "blocked-runtime" : "clear-runtime",
  };
  assert(!prohibited.test(JSON.stringify(report)), "Sanitized runtime audit report contains a prohibited value.");
  return report;
}
export function verifyRuntimeAuditReport(report) {
  assert(report?.schemaVersion === 2, "Runtime audit report is missing or invalid.");
  assert(report.endpointStatus === "available", `Runtime audit endpoint is ${report.endpointStatus}.`);
  assert(report.lockfileClean === true, "package-lock.json changed during the audit job.");
  assert(report.sanitizationDetected === false, "Runtime audit sanitizer detected a prohibited value.");
  for (const advisory of report.advisories ?? []) {
    assert(advisory.advisoryIds?.length > 0, `Runtime audit finding has no advisory identifier: ${advisory.package}.`);
    assert(advisory.runtimeClassification !== "unresolved", `Runtime audit finding is unresolved: ${advisory.package}.`);
    assert(!(["high", "critical"].includes(advisory.severity) && advisory.runtimeClassification === "request-time reachable Worker runtime"), `High/critical runtime audit finding is request-time reachable: ${advisory.package}.`);
  }
  return report;
}
function auditPayload() {
  const result = runNpm(["audit", "--omit=dev", "--json"]);
  return parseAuditCommandResult({
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
    spawnError: result.error?.code ?? null,
    registryHostname: registryHostname(),
  });
}
function registryHostname() {
  try {
    const result = runNpm(["config", "get", "registry"]);
    if (result.status !== 0) return null;
    const configured = String(result.stdout ?? "").trim();
    return new URL(configured).hostname;
  } catch { return null; }
}
function npmVersion() {
  try {
    const result = runNpm(["--version"]);
    return result.status === 0 ? String(result.stdout ?? "").trim() : "unknown";
  } catch { return "unknown"; }
}
function lockfileClean() {
  try { execFileSync("git", ["diff", "--exit-code", "--", "package-lock.json"], { stdio: "ignore" }); return true; } catch { return false; }
}
function writeReport(report) {
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
function publishSummary(report) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const totals = report.totals ? Object.entries(report.totals).map(([severity, count]) => `${severity}=${count}`).join(", ") : "unavailable";
  writeFileSync(summaryPath, `## Runtime dependency audit\n\n- Endpoint: ${report.endpointStatus}\n- Capture: ${report.captureResult}\n- Response schema: ${report.diagnostics.responseSchema}\n- Registry hostname: ${report.diagnostics.registryHostname ?? "unavailable"}\n- Totals: ${totals}\n- Findings: ${report.advisories.length}\n- Gate: ${report.releaseGate}\n`, { encoding: "utf8", flag: "a" });
}

const args = new Set(process.argv.slice(2));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = readJson("package-lock.json");
  const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
  let report;
  try {
    const audit = auditPayload();
    report = createRuntimeAuditReport({ ...audit, inventory, npmVersion: npmVersion(), lockfileVersion: lock.lockfileVersion ?? null, lockfileClean: lockfileClean() });
  } catch (error) {
    report = { schemaVersion: 2, endpointStatus: "malformed", captureResult: "sanitized-report-construction-failed", command: "npm audit --omit=dev --json", diagnostics: noJsonDiagnostics({ stdout: "", stderr: "", exitCode: null, registryHostname: null, responseSchema: "unexpected-npm-schema-version" }), advisories: [], sanitizationDetected: false, releaseGate: "blocked-audit-malformed", error: "sanitized-report-construction-failed" };
    writeReport(report);
    throw error;
  }
  writeReport(report);
  publishSummary(report);
  console.log(`RUNTIME AUDIT REPORT: ${report.endpointStatus}; ${report.advisories.length} package findings; gate=${report.releaseGate}.`);
  if (!args.has("--allow-unavailable")) verifyRuntimeAuditReport(report);
}
