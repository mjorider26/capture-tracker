import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const reportPath = ".artifacts/dependency-audit.json";
const prohibited = /(?:postgres(?:ql)?:\/\/|(?:api|access)[_-]?key\s*[=:]|password\s*[=:]|token\s*[=:]|secret\s*[=:]|[A-Z]:\\|\/(?:home|Users|tmp)\/)/i;
let payload;
try {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const output = execFileSync(command, ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  payload = JSON.parse(output);
} catch (error) {
  const output = `${error.stdout ?? ""}`;
  try { payload = JSON.parse(output); } catch { payload = null; }
}
const vulnerabilities = Object.entries(payload?.vulnerabilities ?? {}).map(([name, finding]) => ({
  package: name,
  severity: finding.severity ?? "unknown",
  direct: Boolean(finding.isDirect),
  range: finding.range ?? null,
  advisoryIds: (finding.via ?? []).filter((via) => typeof via === "object").map((via) => String(via.url ?? "").match(/GHSA-[\w-]+/i)?.[0] ?? null).filter(Boolean),
  fixAvailable: Boolean(finding.fixAvailable),
})).sort((left, right) => left.package.localeCompare(right.package));
const report = payload ? { schemaVersion: 1, status: "available", totals: payload.metadata?.vulnerabilities ?? {}, vulnerabilities } : { schemaVersion: 1, status: "unavailable", totals: null, vulnerabilities: [] };
if (prohibited.test(JSON.stringify(report))) throw new Error("Sanitized dependency audit report contains a prohibited value.");
mkdirSync(".artifacts", { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`DEPENDENCY AUDIT REPORT: ${report.status}; ${report.status === "available" ? `${vulnerabilities.length} package findings` : "endpoint unavailable"}.`);
