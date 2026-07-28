import { fetchWithTimeout } from "./linux-proof-lifecycle.mjs";

const contracts = {
  live: { status: 200, state: "live", mismatch: "LIVE_CONTRACT_MISMATCH" },
  readyFailClosed: { status: 503, state: "not_ready", mismatch: "READY_FAIL_CLOSED_CONTRACT_MISMATCH" },
};

function safeState(value, expected) {
  return value === expected ? value : null;
}

export async function validateHealthResponse(response, contractName) {
  const contract = contracts[contractName];
  if (!contract) throw new Error("Unknown health contract.");
  const status = response.status;
  let body;
  try {
    body = await response.json();
  } catch {
    return { status, contractResult: "fail", failureCode: "HEALTH_RESPONSE_INVALID_JSON", state: null, topLevelFields: [] };
  }
  const topLevelFields = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).sort().slice(0, 10) : [];
  const matches = status === contract.status && topLevelFields.length === 1 && topLevelFields[0] === "status" && body.status === contract.state;
  return {
    status,
    contractResult: matches ? "pass" : "fail",
    failureCode: matches ? null : status !== contract.status ? "HEALTH_STATUS_MISMATCH" : contract.mismatch,
    state: safeState(body?.status, contract.state),
    topLevelFields,
  };
}

export async function pollHealthContract({ url, contractName, attempts, requestTimeoutMs, intervalMs, fetchImpl = fetch, stopWhen = null, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) }) {
  let latest = { status: null, contractResult: "fail", failureCode: "HEALTH_NOT_ATTEMPTED", state: null, topLevelFields: [], attempts: 0, durationMs: 0 };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const stop = stopWhen?.();
    if (stop) return { ...latest, attempts: attempt - 1, failureCode: stop };
    const started = Date.now();
    try {
      const response = await fetchWithTimeout(url, { timeoutMs: requestTimeoutMs, fetchImpl });
      latest = { ...(await validateHealthResponse(response, contractName)), attempts: attempt, durationMs: Date.now() - started };
      if (latest.contractResult === "pass") return latest;
    } catch (error) {
      latest = { status: null, contractResult: "fail", failureCode: error instanceof Error && error.name === "AbortError" ? "HEALTH_FETCH_TIMEOUT" : "HEALTH_FETCH_FAILED", state: null, topLevelFields: [], attempts: attempt, durationMs: Date.now() - started };
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  return latest;
}
