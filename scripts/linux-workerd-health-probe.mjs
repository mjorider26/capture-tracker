import { pollHealthContract } from "./linux-proof-health-contract.mjs";

export function safeHealthEvidence(result) {
  return { httpStatus: result.httpStatus, contentType: result.contentType, topLevelFields: result.topLevelFields, state: result.state, code: result.code, contractResult: result.contractResult, failureCode: result.failureCode, attempts: result.attempts, durationMs: result.durationMs };
}

export async function probeWorkerdHealth({ baseUrl, fetchImpl, stopWhen, liveAttempts = 30, liveRequestTimeoutMs = 1_000, readyRequestTimeoutMs = 1_500, intervalMs = 250 }) {
  const live = await pollHealthContract({ url: `${baseUrl}/api/health/live`, contractName: "live", attempts: liveAttempts, requestTimeoutMs: liveRequestTimeoutMs, intervalMs, fetchImpl, stopWhen });
  if (live.contractResult !== "pass") return { result: "fail", failedEndpoint: "live", live: safeHealthEvidence(live), ready: null };
  const ready = await pollHealthContract({ url: `${baseUrl}/api/health/ready`, contractName: "readyFailClosed", attempts: 1, requestTimeoutMs: readyRequestTimeoutMs, intervalMs: 0, fetchImpl, stopWhen });
  return { result: ready.contractResult === "pass" ? "pass" : "fail", failedEndpoint: ready.contractResult === "pass" ? null : "ready", live: safeHealthEvidence(live), ready: safeHealthEvidence(ready) };
}
