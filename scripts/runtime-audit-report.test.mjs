import { createRuntimeAuditReport, parseAuditCommandResult, verifyRuntimeAuditReport } from "./runtime-audit-report.mjs";

function assert(condition, message) { if (!condition) throw new Error(message); }
const inventory = {
  schemaVersion: 1,
  reportSanitized: true,
  packages: [
    { package: "sharp", classification: "conditional runtime package", requestTimeReachability: "not-reachable" },
    { package: "postcss", classification: "build-time only", requestTimeReachability: "not-reachable" },
    { package: "pg", classification: "bundled in Worker executable code", requestTimeReachability: "reachable" },
    { package: "unknown-runtime", classification: "unresolved", requestTimeReachability: "unresolved" },
  ],
};
function payload(vulnerabilities) { return { metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: Object.keys(vulnerabilities).length } }, vulnerabilities }; }
function finding({ severity = "moderate", via = [{ name: "package", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc" }], direct = false } = {}) { return { severity, via, isDirect: direct, range: "<=1.0.0", fixAvailable: { name: "package", version: "1.0.1", isSemVerMajor: false } }; }

const cleanPayload = payload({});
assert(parseAuditCommandResult({ stdout: JSON.stringify(cleanPayload) }).endpointStatus === "available", "Valid clean npm audit JSON must be accepted.");
const vulnerablePayload = payload({ pg: finding({ severity: "high" }) });
const nonzeroVulnerable = parseAuditCommandResult({ stdout: JSON.stringify(vulnerablePayload), stderr: "npm error code EEXIT", exitCode: 1 });
assert(nonzeroVulnerable.endpointStatus === "available" && nonzeroVulnerable.payload.vulnerabilities.pg, "Valid vulnerable JSON must be accepted despite npm's nonzero exit code.");
const warningPrefixed = parseAuditCommandResult({ stdout: `npm warn deprecated fixture\n${JSON.stringify(cleanPayload)}\nnpm warn complete` });
assert(warningPrefixed.endpointStatus === "available", "Warnings before or after JSON must not prevent audit parsing.");
const stderrDiagnostic = parseAuditCommandResult({ stdout: JSON.stringify(cleanPayload), stderr: "npm warn audit diagnostics", exitCode: 1 });
assert(stderrDiagnostic.endpointStatus === "available", "Diagnostics on stderr must not replace valid stdout audit JSON.");
const escapedJson = payload({ postcss: { ...finding({ via: [{ source: 123456, name: "postcss", title: 'escaped quote " and brace }' }] }), severity: "high" } });
assert(parseAuditCommandResult({ stdout: `npm warn fixture\n${JSON.stringify(escapedJson)}` }).endpointStatus === "available", "Escaped JSON strings must not terminate JSON extraction early.");
assert(parseAuditCommandResult({ stdout: '{"metadata":' }).endpointStatus === "malformed", "Truncated audit JSON must be malformed.");
assert(parseAuditCommandResult({ stderr: "npm error code EAI_AGAIN", exitCode: 1 }).endpointStatus === "unavailable", "Unavailable audit endpoints must remain unavailable.");

const clean = createRuntimeAuditReport({ payload: payload({ postcss: finding() }), inventory, now: new Date("2026-07-26T00:00:00.000Z"), npmVersion: "11.0.0", lockfileVersion: 3 });
assert(clean.endpointStatus === "available" && clean.releaseGate === "clear-runtime", "Clean/non-runtime audit must clear the runtime gate.");
verifyRuntimeAuditReport(clean);
const highReachable = createRuntimeAuditReport({ payload: payload({ pg: finding({ severity: "high" }) }), inventory });
assert(highReachable.advisories[0].releaseGateEffect === "block-reachable-high", "High reachable advisory must block.");
let rejected = false; try { verifyRuntimeAuditReport(highReachable); } catch { rejected = true; } assert(rejected, "High reachable advisory must fail verification.");
const moderateReachable = createRuntimeAuditReport({ payload: payload({ pg: finding({ severity: "moderate" }) }), inventory });
verifyRuntimeAuditReport(moderateReachable);
const absent = createRuntimeAuditReport({ payload: payload({ postcss: finding({ severity: "high" }) }), inventory });
assert(absent.advisories[0].runtimeClassification === "absent from deployed artifact", "Build-only advisory must be absent from deployed artifact.");
verifyRuntimeAuditReport(absent);
const numericSource = createRuntimeAuditReport({ payload: payload({ postcss: finding({ via: [{ source: 123456, name: "postcss" }] }) }), inventory });
assert(numericSource.advisories[0].advisoryIds[0] === "NPM-AUDIT-123456", "Numeric npm audit sources must be retained as advisory identifiers.");
const aggregate = createRuntimeAuditReport({ payload: payload({ wrapper: finding({ via: ["postcss"] }), postcss: finding({ severity: "high" }) }), inventory });
assert(aggregate.advisories.find((entry) => entry.package === "wrapper")?.advisoryIds[0] === "GHSA-AAAA-BBBB-CCCC", "Aggregate audit findings must inherit an advisory identifier from their dependency chain.");
verifyRuntimeAuditReport(aggregate);
const unresolved = createRuntimeAuditReport({ payload: payload({ "unknown-runtime": finding() }), inventory });
rejected = false; try { verifyRuntimeAuditReport(unresolved); } catch { rejected = true; } assert(rejected, "Unresolved runtime advisory must fail verification.");
const unavailable = createRuntimeAuditReport({ payload: null, inventory });
assert(unavailable.endpointStatus === "unavailable", "Unavailable endpoint must be recorded.");
rejected = false; try { verifyRuntimeAuditReport(unavailable); } catch { rejected = true; } assert(rejected, "Unavailable endpoint must fail verification.");
const malformed = createRuntimeAuditReport({ payload: { error: "down" }, inventory });
assert(malformed.endpointStatus === "malformed", "Malformed audit JSON must be recorded.");
rejected = false; try { createRuntimeAuditReport({ payload: payload({ sharp: finding({ via: [{ name: "sharp" }] }) }), inventory }); } catch { rejected = true; } assert(rejected, "Missing advisory identifier must fail construction.");
const redacted = createRuntimeAuditReport({ payload: payload({ sharp: { ...finding(), range: "postgresql://unsafe" } }), inventory });
assert(redacted.sanitizationDetected && !JSON.stringify(redacted).includes("postgresql://"), "Secrets and absolute paths must be redacted and flagged.");
const dirtyLock = createRuntimeAuditReport({ payload: payload({ postcss: finding() }), inventory, lockfileClean: false });
rejected = false; try { verifyRuntimeAuditReport(dirtyLock); } catch { rejected = true; } assert(rejected, "Lockfile mutation must fail verification.");
console.log("RUNTIME AUDIT REPORT SYNTHETIC TESTS PASSED: clean, reachable, absent, tooling, unresolved, unavailable, malformed, identifier, sanitization, and lockfile cases verified.");
