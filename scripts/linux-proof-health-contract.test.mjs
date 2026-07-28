import assert from "node:assert/strict";
import test from "node:test";
import { pollHealthContract, validateHealthResponse } from "./linux-proof-health-contract.mjs";

function response(status, body) { return { status, json: async () => body }; }

test("live 200 with the documented body passes", async () => {
  assert.deepEqual(await validateHealthResponse(response(200, { status: "live" }), "live"), { status: 200, contractResult: "pass", failureCode: null, state: "live", topLevelFields: ["status"] });
});

test("live 200 with the wrong body retains status and fails", async () => {
  const result = await validateHealthResponse(response(200, { status: "ready" }), "live");
  assert.equal(result.status, 200);
  assert.equal(result.contractResult, "fail");
  assert.equal(result.failureCode, "LIVE_CONTRACT_MISMATCH");
});

test("live non-200 retains the actual status", async () => {
  const result = await validateHealthResponse(response(503, { status: "not_ready" }), "live");
  assert.equal(result.status, 503);
  assert.equal(result.failureCode, "HEALTH_STATUS_MISMATCH");
});

test("only documented fail-closed readiness passes", async () => {
  assert.equal((await validateHealthResponse(response(503, { status: "not_ready" }), "readyFailClosed")).contractResult, "pass");
  assert.equal((await validateHealthResponse(response(503, { status: "unknown" }), "readyFailClosed")).contractResult, "fail");
});

test("readiness 200 is not accepted for the no-provider proof", async () => {
  const result = await validateHealthResponse(response(200, { status: "ready" }), "readyFailClosed");
  assert.equal(result.contractResult, "fail");
  assert.equal(result.failureCode, "HEALTH_STATUS_MISMATCH");
});

test("fetch timeout fails safely and response state propagates", async () => {
  const result = await pollHealthContract({
    url: "http://127.0.0.1/fictional",
    contractName: "live",
    attempts: 1,
    requestTimeoutMs: 5,
    intervalMs: 0,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
  });
  assert.deepEqual(result, { status: null, contractResult: "fail", failureCode: "HEALTH_FETCH_TIMEOUT", state: null, topLevelFields: [], attempts: 1, durationMs: result.durationMs });
});

test("bounded polling returns documented liveness evidence without a response body", async () => {
  const result = await pollHealthContract({ url: "http://127.0.0.1/fictional", contractName: "live", attempts: 1, requestTimeoutMs: 100, intervalMs: 0, fetchImpl: async () => response(200, { status: "live" }) });
  assert.equal(result.status, 200);
  assert.equal(result.contractResult, "pass");
  assert.deepEqual(result.topLevelFields, ["status"]);
  assert.equal(Object.hasOwn(result, "body"), false);
});
