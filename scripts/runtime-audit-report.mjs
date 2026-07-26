import { execFileSync } from "node:child_process";
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
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function sanitized(value, state) {
  if (typeof value !== "string") return value;
  if (!prohibited.test(value)) return value;
  state.redactions += 1;
  return "[redacted]";
}
function advisoryId(via) {
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
export function createRuntimeAuditReport({ payload, inventory, now = new Date(), nodeVersion = process.version, npmVersion = "unknown", lockfileVersion = null, lockfileClean = true }) {
  const state = { redactions: 0 };
  const base = {
    schemaVersion: 2,
    generatedAtUtc: now.toISOString(),
    nodeVersion: sanitized(nodeVersion, state),
    npmVersion: sanitized(npmVersion, state),
    lockfileVersion,
    command: "npm audit --omit=dev --json",
    lockfileClean,
  };
  if (payload === null) return { ...base, endpointStatus: "unavailable", totals: null, advisories: [], sanitizationDetected: false, releaseGate: "blocked-audit-unavailable" };
  if (!payload || typeof payload !== "object" || !payload.metadata?.vulnerabilities || !payload.vulnerabilities || typeof payload.vulnerabilities !== "object") {
    return { ...base, endpointStatus: "malformed", totals: null, advisories: [], sanitizationDetected: false, releaseGate: "blocked-audit-malformed" };
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
  try {
    return JSON.parse(execFileSync(command(), ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch (error) {
    const output = `${error.stdout ?? ""}`;
    try { return JSON.parse(output); } catch { return null; }
  }
}
function npmVersion() {
  try { return execFileSync(command(), ["--version"], { encoding: "utf8" }).trim(); } catch { return "unknown"; }
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
  writeFileSync(summaryPath, `## Runtime dependency audit\n\n- Endpoint: ${report.endpointStatus}\n- Totals: ${totals}\n- Findings: ${report.advisories.length}\n- Gate: ${report.releaseGate}\n`, { encoding: "utf8", flag: "a" });
}

const args = new Set(process.argv.slice(2));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = readJson("package-lock.json");
  const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
  let report;
  try {
    report = createRuntimeAuditReport({ payload: auditPayload(), inventory, npmVersion: npmVersion(), lockfileVersion: lock.lockfileVersion ?? null, lockfileClean: lockfileClean() });
  } catch (error) {
    report = { schemaVersion: 2, endpointStatus: "malformed", command: "npm audit --omit=dev --json", advisories: [], sanitizationDetected: false, releaseGate: "blocked-audit-malformed", error: "sanitized-report-construction-failed" };
    writeReport(report);
    throw error;
  }
  writeReport(report);
  publishSummary(report);
  console.log(`RUNTIME AUDIT REPORT: ${report.endpointStatus}; ${report.advisories.length} package findings; gate=${report.releaseGate}.`);
  if (!args.has("--allow-unavailable")) verifyRuntimeAuditReport(report);
}
