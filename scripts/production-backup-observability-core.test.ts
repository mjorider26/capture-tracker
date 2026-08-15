import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  cleanupTemporaryPaths,
  operationalCommandError,
  sanitizedFailureFields,
  sanitizedFailureLine,
} from "./production-backup-observability-core";
import { ScopedR2OperationError } from "./r2-scoped-object-storage";

describe("production backup observability", () => {
  it("reports a precise safe stage without leaking an unexpected error message", () => {
    const line = sanitizedFailureLine({
      operation: "BACKUP",
      stage: "BACKUP_PREFLIGHT",
      component: "backup_passphrase",
      error: new Error("secret-value-must-not-appear"),
      cleanup: "PASS",
    });
    expect(line).toBe("BACKUP_FAILED stage=BACKUP_PREFLIGHT component=backup_passphrase exit=1 detail=UNEXPECTED_ERROR cleanup=PASS");
    expect(line).not.toContain("secret-value-must-not-appear");
  });

  it("retains only categorized command diagnostics and the real exit code", () => {
    const error = operationalCommandError("BACKUP_COMMAND_FAILED", 23, "password authentication failed for private input");
    expect(sanitizedFailureFields(error)).toEqual({
      detail: "BACKUP_COMMAND_FAILED",
      exitCode: 23,
      summary: "AUTHENTICATION_FAILED",
      httpStatus: undefined,
      providerCode: undefined,
    });
  });

  it("reports only the safe R2 status and provider code", () => {
    expect(sanitizedFailureFields(new ScopedR2OperationError(403, "AccessDenied"))).toEqual({
      detail: "R2_OBJECT_OPERATION_FAILED",
      exitCode: 1,
      summary: undefined,
      httpStatus: 403,
      providerCode: "AccessDenied",
    });
  });

  it("reports cleanup success and fails closed when an artifact remains", () => {
    const root = mkdtempSync(join(tmpdir(), "capture-tracker-backup-observability-"));
    const temporary = join(root, "temporary.dump");
    try {
      writeFileSync(temporary, "fictional");
      expect(cleanupTemporaryPaths([temporary])).toEqual({ status: "PASS", retainedCount: 0 });

      writeFileSync(temporary, "fictional");
      expect(cleanupTemporaryPaths([root])).toEqual({ status: "FAIL", retainedCount: 1 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
