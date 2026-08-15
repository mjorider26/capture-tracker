import { existsSync, rmSync } from "node:fs";

export type BackupStage =
  | "BACKUP_PREFLIGHT"
  | "DATABASE_DUMP"
  | "DUMP_VALIDATION"
  | "ENCRYPTION"
  | "ENCRYPTED_ARTIFACT_VALIDATION"
  | "CHECKSUM"
  | "MANIFEST"
  | "R2_UPLOAD"
  | "REMOTE_CHECKSUM_VERIFY"
  | "R2_RECEIPT"
  | "RESTORE_PREP"
  | "ISOLATED_RESTORE"
  | "RECOVERABILITY_METADATA"
  | "CLEANUP";

type OperationalError = Error & {
  exitCode?: number;
  httpStatus?: number;
  providerCode?: string;
  safeSummary?: string;
};

const safeFailureCode = /^(?:[A-Z0-9]+_)*(?:FAILED|REFUSED|REQUIRED|UNAVAILABLE|MISMATCH|ERROR)$/;
const safeProviderCode = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

function safeCommandSummary(output: string) {
  const normalized = output.toLowerCase();
  if (/password authentication failed|authentication failed|invalid access key|invalidaccesskeyid|signaturedoesnotmatch/.test(normalized)) return "AUTHENTICATION_FAILED";
  if (/permission denied|access denied|accessdenied|forbidden/.test(normalized)) return "PERMISSION_DENIED";
  if (/no space left|disk full/.test(normalized)) return "STORAGE_UNAVAILABLE";
  if (/could not connect|connection refused|connection timed out|network.*unreachable|timeout/.test(normalized)) return "CONNECTION_FAILED";
  if (/not found|no such file/.test(normalized)) return "DEPENDENCY_UNAVAILABLE";
  return "COMMAND_FAILED";
}

export function operationalCommandError(message: "BACKUP_COMMAND_FAILED" | "RESTORE_COMMAND_FAILED", exitCode: number | null, output: string) {
  const error = new Error(message) as OperationalError;
  error.exitCode = Number.isInteger(exitCode) && exitCode !== null ? exitCode : 1;
  error.safeSummary = safeCommandSummary(output);
  return error;
}

export function cleanupTemporaryPaths(paths: string[]) {
  let failed = false;
  for (const path of paths) {
    try {
      rmSync(path, { force: true });
    } catch {
      failed = true;
    }
  }
  const retainedCount = paths.filter((path) => existsSync(path)).length;
  return { status: failed || retainedCount ? "FAIL" as const : "PASS" as const, retainedCount };
}

export function sanitizedFailureFields(error: unknown) {
  const operational = error instanceof Error ? error as OperationalError : undefined;
  const message = operational?.message ?? "UNEXPECTED_ERROR";
  const detail = safeFailureCode.test(message) && message.length <= 96 ? message : "UNEXPECTED_ERROR";
  const exitCode = Number.isInteger(operational?.exitCode) && operational!.exitCode! >= 0 && operational!.exitCode! <= 255
    ? operational!.exitCode!
    : 1;
  const summary = operational?.safeSummary && safeFailureCode.test(operational.safeSummary)
    ? operational.safeSummary
    : undefined;
  const httpStatus = Number.isInteger(operational?.httpStatus) && operational!.httpStatus! >= 100 && operational!.httpStatus! <= 599
    ? operational!.httpStatus!
    : undefined;
  const providerCode = operational?.providerCode && safeProviderCode.test(operational.providerCode)
    ? operational.providerCode
    : undefined;
  return { detail, exitCode, summary, httpStatus, providerCode };
}

export function sanitizedFailureLine({
  operation,
  stage,
  component,
  error,
  cleanup,
}: {
  operation: "BACKUP" | "RESTORE";
  stage: BackupStage;
  component: string;
  error: unknown;
  cleanup: "PASS" | "FAIL";
}) {
  const fields = sanitizedFailureFields(error);
  const optional = [
    fields.summary ? `summary=${fields.summary}` : "",
    fields.httpStatus ? `httpStatus=${fields.httpStatus}` : "",
    fields.providerCode ? `providerCode=${fields.providerCode}` : "",
  ].filter(Boolean).join(" ");
  return `${operation}_FAILED stage=${stage} component=${component} exit=${fields.exitCode} detail=${fields.detail}${optional ? ` ${optional}` : ""} cleanup=${cleanup}`;
}
