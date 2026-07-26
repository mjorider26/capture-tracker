import { createRuntimeAuditReport, verifyRuntimeAuditReport } from "./runtime-audit-report.mjs";

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
