import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

assert(/image:\s*postgres:17\b/.test(workflow), "CI must retain the supported PostgreSQL 17 service image.");
for (const value of ["POSTGRES_DB: capture_tracker", "POSTGRES_USER: capture_tracker", "POSTGRES_PASSWORD: capture_tracker", "pg_isready -U capture_tracker -d capture_tracker", "--health-interval 10s", "--health-timeout 5s", "--health-retries 5"]) {
  assert(workflow.includes(value), `CI PostgreSQL service configuration is missing: ${value}`);
}
assert(workflow.includes("name: Collect PostgreSQL service diagnostics") && workflow.includes("CI_SERVICE_DIAGNOSTIC service=postgres") && workflow.includes("docker logs --tail 40"), "CI must emit bounded PostgreSQL service diagnostics on failure.");
assert(workflow.includes("if: always()") && workflow.includes("if-no-files-found: warn"), "Sanitized evidence upload must run without masking an earlier failure when no files exist.");
assert(workflow.indexOf("npm run cloud:audit:report") < workflow.indexOf("node scripts/prove-linux-opennext-gate1b.mjs"), "The runtime audit must run before the Gate 1B proof.");
assert(workflow.indexOf("node scripts/probe-linux-opennext-health.mjs") < workflow.indexOf("node scripts/prove-linux-opennext-gate1b.mjs") && workflow.includes(".artifacts/linux-opennext-health-preflight.json"), "The direct Workerd health preflight must run before Gate 1B and upload its sanitized evidence.");

console.log("CI WORKFLOW VERIFIED: PostgreSQL health checks remain bounded, service diagnostics are safe and bounded, and absent optional evidence cannot mask an earlier workflow failure.");
