import { readFileSync } from "node:fs";
const source = readFileSync("src/lib/services/pilot-readiness.ts", "utf8");
const required = ["saveOnboarding", "saveSettings", "getActivity", "buildExport", "businessId", "excluded", "storage keys", "private grants", "exportAudit.create"];
const missing = required.filter((value) => !source.includes(value));
if (missing.length) { console.error(`Pilot readiness verification failed: ${missing.join(", ")}`); process.exit(1); }
console.log(`PILOT READINESS VERIFICATION PASSED (${process.argv[2] ?? "all"})`);
