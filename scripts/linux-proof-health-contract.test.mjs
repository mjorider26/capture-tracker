import assert from "node:assert/strict";
import test from "node:test";
import { healthContracts, inspectHealthResponse, validateHealthPayload } from "../src/lib/health-contract.mjs";
import { pollHealthContract } from "./linux-proof-health-contract.mjs";

test("liveness 200 with its required status passes", () => {
  assert.equal(validateHealthPayload({ httpStatus: 200, contentType: "application/json", payload: { status: "live" } }, "live").contractResult, "pass");
});

test("liveness permits documented additional safe fields", () => {
  const result = validateHealthPayload({ httpStatus: 200, contentType: "application/json", payload: { status: "live", version: "safe" } }, "live");
  assert.equal(result.contractResult, "pass");
  assert.deepEqual(result.topLevelFields, ["status", "version"]);
});

test("wrong liveness state preserves its HTTP 200", () => {
  const result = validateHealthPayload({ httpStatus: 200, contentType: "application/json", payload: { status: "ready" } }, "live");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.failureCode, "LIVE_CONTRACT_MISMATCH");
});

test("non-200 liveness preserves the actual status", () => {
  const result = validateHealthPayload({ httpStatus: 404, contentType: "text/html", payload: null }, "live");
  assert.equal(result.httpStatus, 404);
  assert.equal(result.contentType, "non_json");
  assert.equal(result.failureCode, "HEALTH_STATUS_MISMATCH");
});

test("only the documented fail-closed readiness contract passes", () => {
  assert.equal(validateHealthPayload({ httpStatus: healthContracts.readyFailClosed.httpStatus, contentType: "application/json", payload: { status: healthContracts.readyFailClosed.status } }, "readyFailClosed").contractResult, "pass");
  assert.equal(validateHealthPayload({ httpStatus: 503, contentType: "application/json", payload: { status: "unavailable" } }, "readyFailClosed").contractResult, "fail");
});

test("readiness permits additional safe fields but rejects a missing status", () => {
  assert.equal(validateHealthPayload({ httpStatus: 503, contentType: "application/json", payload: { status: "not_ready", check: "database" } }, "readyFailClosed").contractResult, "pass");
  assert.equal(validateHealthPayload({ httpStatus: 503, contentType: "application/json", payload: { check: "database" } }, "readyFailClosed").failureCode, "READY_FAIL_CLOSED_CONTRACT_MISMATCH");
});

test("invalid JSON and content-type mismatch are safe and distinguishable", async () => {
  const invalid = await inspectHealthResponse({ status: 503, headers: { get: () => "application/json" }, json: async () => { throw new Error("invalid"); } }, "readyFailClosed");
  const html = await inspectHealthResponse({ status: 404, headers: { get: () => "text/html" }, json: async () => { throw new Error("html"); } }, "live");
  assert.equal(invalid.failureCode, "HEALTH_RESPONSE_INVALID_JSON");
  assert.equal(html.httpStatus, 404);
  assert.equal(html.contentType, "non_json");
});

test("fetch timeout is bounded and response state is never fabricated", async () => {
  const result = await pollHealthContract({ url: "http://127.0.0.1/fictional", contractName: "live", attempts: 1, requestTimeoutMs: 5, intervalMs: 0, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  assert.equal(result.failureCode, "HEALTH_FETCH_TIMEOUT");
  assert.equal(result.httpStatus, null);
});

test("polling parses once and records only safe evidence", async () => {
  let parsed = 0;
  const result = await pollHealthContract({ url: "http://127.0.0.1/fictional", contractName: "live", attempts: 1, requestTimeoutMs: 100, intervalMs: 0, fetchImpl: async () => ({ status: 200, headers: { get: () => "application/json" }, json: async () => { parsed += 1; return { status: "live" }; } }) });
  assert.equal(parsed, 1);
  assert.equal(result.httpStatus, 200);
  assert.equal(Object.hasOwn(result, "body"), false);
});
