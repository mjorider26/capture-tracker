const patterns = [
  { category: "DATABASE_URL", reason: "SANITIZED_OUTPUT_POLICY", expression: /(?:postgres(?:ql)?:\/\/)[^\s"']+/i, replacement: "[redacted-database-url]" },
  { category: "SECRET_VALUE", reason: "SANITIZED_OUTPUT_POLICY", expression: /(?:(?:api|access)[_-]?key|password|secret|token)\s*[=:]\s*\S+/i, replacement: "[redacted-secret]" },
  { category: "URL", reason: "SANITIZED_OUTPUT_POLICY", expression: /https?:\/\/[^\s"']+/i, replacement: "[redacted-url]" },
  { category: "PRIVATE_ADDRESS", reason: "SANITIZED_OUTPUT_POLICY", expression: /(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/i, replacement: "[redacted-address]" },
  { category: "ABSOLUTE_PATH", reason: "SANITIZED_OUTPUT_POLICY", expression: /(?:[A-Z]:\\|\/(?:home|Users|tmp|var|private)\/)[^\s"']*/i, replacement: "[redacted-path]" },
  { category: "ACCOUNT_IDENTIFIER", reason: "SANITIZED_OUTPUT_POLICY", expression: /account(?:\s+id)?\s*[=:]\s*\S+/i, replacement: "account=[redacted]" },
];

function sanitizeLine(line) {
  let value = line;
  let redactions = 0;
  for (const rule of patterns) {
    if (rule.expression.test(value)) {
      value = value.replace(rule.expression, rule.replacement);
      redactions += 1;
    }
  }
  return { value: value.slice(0, 240), redactions };
}

export function summarizeOutput(value) {
  const lines = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const first = lines[0] ?? null;
  const last = lines.at(-1) ?? null;
  const firstSanitized = first === null ? null : sanitizeLine(first);
  const lastSanitized = last === null ? null : sanitizeLine(last);
  return {
    firstLine: firstSanitized?.value ?? null,
    finalLine: lastSanitized?.value ?? null,
    lineCount: lines.length,
    redactionCount: (firstSanitized?.redactions ?? 0) + (lastSanitized?.redactions ?? 0),
  };
}

export function findProhibitedValue(value, path = "report") {
  if (typeof value === "string") {
    for (const rule of patterns) if (rule.expression.test(value)) return { path, category: rule.category, reason: rule.reason };
    return null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const finding = findProhibitedValue(value[index], `${path}[${index}]`);
      if (finding) return finding;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const finding = findProhibitedValue(item, `${path}.${key}`);
      if (finding) return finding;
    }
  }
  return null;
}

export function assertSanitizedReport(report) {
  const finding = findProhibitedValue(report);
  if (finding) {
    const error = new Error(`Gate 1B report rejected at ${finding.path}: ${finding.category} (${finding.reason}).`);
    error.code = "GATE1B_REPORT_SANITIZATION_FAILED";
    error.finding = finding;
    throw error;
  }
  return report;
}
