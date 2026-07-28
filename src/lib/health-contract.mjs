export const healthContracts = Object.freeze({
  live: Object.freeze({ httpStatus: 200, status: "live", mismatch: "LIVE_CONTRACT_MISMATCH" }),
  readyFailClosed: Object.freeze({ httpStatus: 503, status: "not_ready", mismatch: "READY_FAIL_CLOSED_CONTRACT_MISMATCH" }),
});

const safeStates = new Set(["live", "ready", "not_ready"]);
const safeCodes = new Set(["DATABASE_UNAVAILABLE"]);

function contentTypeCategory(value) {
  if (!value) return "missing";
  return value.toLowerCase().includes("application/json") ? "json" : "non_json";
}

function safeValue(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

export function validateHealthPayload({ httpStatus, contentType, payload }, contractName) {
  const contract = healthContracts[contractName];
  if (!contract) throw new Error("Unknown health contract.");
  const contentTypeResult = contentTypeCategory(contentType);
  const topLevelFields = payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).sort().slice(0, 10) : [];
  const state = safeValue(payload?.status, safeStates);
  const code = safeValue(payload?.code, safeCodes);
  let failureCode = null;
  if (httpStatus !== contract.httpStatus) failureCode = "HEALTH_STATUS_MISMATCH";
  else if (contentTypeResult !== "json") failureCode = "HEALTH_CONTENT_TYPE_MISMATCH";
  else if (!payload || typeof payload !== "object" || Array.isArray(payload)) failureCode = "HEALTH_RESPONSE_SCHEMA_MISMATCH";
  else if (payload.status !== contract.status) failureCode = contract.mismatch;
  return { httpStatus, contentType: contentTypeResult, topLevelFields, state, code, contractResult: failureCode ? "fail" : "pass", failureCode };
}

export async function inspectHealthResponse(response, contractName) {
  const httpStatus = response.status;
  const contentType = response.headers?.get?.("content-type") ?? null;
  try {
    return validateHealthPayload({ httpStatus, contentType, payload: await response.json() }, contractName);
  } catch {
    return { httpStatus, contentType: contentTypeCategory(contentType), topLevelFields: [], state: null, code: null, contractResult: "fail", failureCode: "HEALTH_RESPONSE_INVALID_JSON" };
  }
}
