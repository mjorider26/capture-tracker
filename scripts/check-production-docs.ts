import { existsSync, readFileSync } from "node:fs";

const authoritative = [
  "README.md",
  "docs/CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md",
  "docs/CURRENT_PRODUCTION_STATE.md",
];
const historical = [
  "docs/PROJECT_STATE.md",
  "docs/BACKUP_AND_RECOVERY.md",
  "docs/CLOUD_DEPLOYMENT_RUNBOOK.md",
  "docs/PRODUCTION_PROVISIONING_PLAN.md",
  "docs/CLOUD_FOUNDATION.md",
  "docs/REAL_DATA_BOUNDARY.md",
  "docs/EXPORTS_AND_PILOT_READINESS.md",
  "docs/ONBOARDING_SETTINGS.md",
  "docs/DOCUMENTS_FOUNDATION.md",
];
const prohibited = [
  /production is undeployed/i,
  /CAPTURE_TRACKER_REAL_DATA_APPROVED\s*=\s*false/i,
  /no production Worker/i,
  /R2 remains blocked/i,
  /invitation required for (?:the )?current first-owner bootstrap/i,
  /current backup recovery unverified/i,
  /reports silently capped at (?:2,000|2000)/i,
];

function text(path: string) {
  if (!existsSync(path)) throw new Error(`Missing documentation file: ${path}`);
  return readFileSync(path, "utf8");
}

for (const path of authoritative) {
  const value = text(path);
  for (const pattern of prohibited) if (pattern.test(value)) throw new Error(`Obsolete production claim in ${path}: ${pattern}`);
}
for (const path of historical) {
  if (!text(path).includes("SUPERSEDED / HISTORICAL")) throw new Error(`Historical operations document is not marked: ${path}`);
}
const runbook = text("docs/CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md");
for (const required of ["CURRENT AUTHORITATIVE OPERATIONS RUNBOOK", "capture-tracker-production", "capture-tracker-production-backups", "50,000-record", "Never do this"]) {
  if (!runbook.includes(required)) throw new Error(`Runbook is missing required operational content: ${required}`);
}
console.log("PRODUCTION DOCUMENTATION VERIFIED");
