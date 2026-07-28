import assert from "node:assert/strict";
import test from "node:test";
import { assertSanitizedReport, findProhibitedValue, summarizeOutput } from "./linux-proof-report-sanitizer.mjs";

test("diagnostic output reduces absolute paths to a symbolic value", () => {
  const summary = summarizeOutput("starting /home/runner/work/capture-tracker/worker.js\nfinished");
  assert.equal(summary.firstLine, "starting [redacted-path]");
  assert.equal(summary.redactionCount, 1);
});

test("database URLs, tokens, and environment values are never persisted", () => {
  const summary = summarizeOutput("DATABASE_URL=postgresql://user:password@example.neon.tech:5432/db?token=abc\nfinished");
  assert.match(summary.firstLine, /redacted-database-url/);
  assert.doesNotMatch(summary.firstLine, /password|example\.neon\.tech|abc/i);
});

test("binding and environment names remain available in a sanitized report", () => {
  const report = {
    bindings: ["ASSETS", "WORKER_SELF_REFERENCE"],
    environmentVariableNames: ["BETTER_AUTH_SECRET", "DATABASE_URL"],
    worker: { sha256: "a".repeat(64), gzipBytes: 12, uncompressedBytes: 24 },
    workerdPreview: { durationMs: 10, liveStatus: 200, readyStatus: 503, diagnostics: { stdout: summarizeOutput("ready"), stderr: summarizeOutput("") } },
  };
  assert.equal(assertSanitizedReport(report), report);
});

test("validator reports a safe field path and category without a prohibited value", () => {
  const value = "postgresql://user:password@example.neon.tech:5432/db";
  const finding = findProhibitedValue({ preview: { stderrTail: value } });
  assert.deepEqual(finding, { path: "report.preview.stderrTail", category: "DATABASE_URL", reason: "SANITIZED_OUTPUT_POLICY" });
  assert.throws(() => assertSanitizedReport({ preview: { stderrTail: value } }), (error) => {
    assert.equal(error.code, "GATE1B_REPORT_SANITIZATION_FAILED");
    assert.match(error.message, /report\.preview\.stderrTail: DATABASE_URL/);
    assert.doesNotMatch(error.message, /example\.neon\.tech|password/);
    return true;
  });
});

test("safe checksums, sizes, durations, and exit codes remain available", () => {
  const report = { worker: { sha256: "b".repeat(64), gzipBytes: 1024, uncompressedBytes: 2048 }, preview: { durationMs: 450, exitCode: 1 } };
  assert.equal(assertSanitizedReport(report), report);
});
