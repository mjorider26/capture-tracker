import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { startManagedProcess, stopManagedProcess } from "./linux-proof-lifecycle.mjs";
import { assertSanitizedReport } from "./linux-proof-report-sanitizer.mjs";
import { probeWorkerdHealth } from "./linux-workerd-health-probe.mjs";
import { cleanWorkerdEnvironment, workerdPreviewArgs } from "./linux-workerd-preview.mjs";

const reportPath = ".artifacts/linux-opennext-health-preflight.json";
const port = 8790;

function write(report) {
  assertSanitizedReport(report);
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  if (process.platform !== "linux") throw new Error("Linux health preflight must run on Linux.");
  if (!existsSync(".open-next/worker.js")) throw new Error("OpenNext Worker entry is missing.");
  const managed = startManagedProcess({ command: "npx", args: workerdPreviewArgs(port), cwd: process.cwd(), env: cleanWorkerdEnvironment() });
  const report = { schemaVersion: 1, deploymentCandidateSha: process.env.GITHUB_SHA ?? null, status: "running", preflight: "workerd-health-contract", health: null, cleanupResult: null, childState: null };
  try {
    report.health = await probeWorkerdHealth({ baseUrl: `http://127.0.0.1:${port}`, stopWhen: () => managed.child.exitCode !== null ? "PREVIEW_CHILD_EXITED" : null });
    write(report);
    if (report.health.result !== "pass") throw new Error(`Workerd health preflight failed at ${report.health.failedEndpoint}.`);
    report.status = "success";
  } catch (error) {
    report.status = "failure";
    report.errorCode = "WORKERD_HEALTH_PREFLIGHT_FAILED";
    write(report);
    throw error;
  } finally {
    const cleanup = await stopManagedProcess(managed);
    report.cleanupResult = cleanup.forced ? "forced" : "clean";
    report.childState = { exitCode: managed.child.exitCode, signal: managed.child.signalCode };
    write(report);
  }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : "Workerd health preflight failed."); process.exit(1); });
