import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const rules = [[/\bRobert\b/i, "PERSON_NAME"], [/(?:AKIA|ASIA)[A-Z0-9]{16}/, "AWS_KEY"], [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, "PRIVATE_KEY"], [/postgres(?:ql)?:\/\/[^\s]+@[^\s]+(?:prod|production)/i, "PRODUCTION_DATABASE_URL"], [/\b\d{9}\b/, "ROUTING_NUMBER_LIKE"]];
const included = ["prisma/", "src/", "public/", "scripts/", "tests/", "infra/", ".github/"];
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean).filter((file) => included.some((prefix) => file.startsWith(prefix)) && !file.startsWith("src/generated/") && !file.startsWith("scripts/verify-"));
const findings = [];
for (const file of files) { let content = ""; try { content = readFileSync(file, "utf8"); } catch { continue; } for (const [pattern, rule] of rules) if (pattern.test(content)) findings.push(`${file}:${rule}`); }
if (findings.length) { console.error(`DATA BOUNDARY FAILED: ${findings.join(", ")}`); process.exitCode = 1; } else console.log("DATA BOUNDARY VERIFIED: tracked repository content contains no detected real-data or credential patterns.");
