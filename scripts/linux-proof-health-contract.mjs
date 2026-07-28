import { fetchWithTimeout } from "./linux-proof-lifecycle.mjs";
import { inspectHealthResponse } from "../src/lib/health-contract.mjs";

export async function pollHealthContract({ url, contractName, attempts, requestTimeoutMs, intervalMs, fetchImpl = fetch, stopWhen = null, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) }) {
  let latest = { httpStatus: null, contentType: "missing", contractResult: "fail", failureCode: "HEALTH_NOT_ATTEMPTED", state: null, code: null, topLevelFields: [], attempts: 0, durationMs: 0 };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const stop = stopWhen?.();
    if (stop) return { ...latest, attempts: attempt - 1, failureCode: stop };
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(url, { timeoutMs: requestTimeoutMs, fetchImpl });
      latest = { ...(await inspectHealthResponse(response, contractName)), attempts: attempt, durationMs: Date.now() - started };
      if (latest.contractResult === "pass") return latest;
    } catch (error) {
      latest = { httpStatus: null, contentType: "missing", contractResult: "fail", failureCode: error instanceof Error && error.name === "AbortError" ? "HEALTH_FETCH_TIMEOUT" : "HEALTH_FETCH_FAILED", state: null, code: null, topLevelFields: [], attempts: attempt, durationMs: Date.now() - started };
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  return latest;
}
