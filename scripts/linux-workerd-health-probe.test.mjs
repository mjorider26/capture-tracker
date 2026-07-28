import assert from "node:assert/strict";
import test from "node:test";
import { probeWorkerdHealth } from "./linux-workerd-health-probe.mjs";

function response(httpStatus, payload, contentType = "application/json") { return { status: httpStatus, headers: { get: () => contentType }, json: async () => payload }; }

test("direct preflight and full proof share the passing health parser", async () => {
  const result = await probeWorkerdHealth({ baseUrl: "http://127.0.0.1/fictional", fetchImpl: async (url) => url.endsWith("/live") ? response(200, { status: "live", version: "safe" }) : response(503, { status: "not_ready", check: "database" }) });
  assert.equal(result.result, "pass");
  assert.equal(result.live.httpStatus, 200);
  assert.equal(result.ready.httpStatus, 503);
  assert.equal(Object.hasOwn(result.ready, "body"), false);
});

test("worker exit before liveness is distinct and does not call readiness", async () => {
  let calls = 0;
  const result = await probeWorkerdHealth({ baseUrl: "http://127.0.0.1/fictional", stopWhen: () => "PREVIEW_CHILD_EXITED", fetchImpl: async () => { calls += 1; return response(200, { status: "live" }); } });
  assert.equal(result.failedEndpoint, "live");
  assert.equal(result.live.failureCode, "PREVIEW_CHILD_EXITED");
  assert.equal(result.ready, null);
  assert.equal(calls, 0);
});

test("worker exit between probes is distinct and preserves liveness", async () => {
  let stopped = false;
  const result = await probeWorkerdHealth({ baseUrl: "http://127.0.0.1/fictional", stopWhen: () => stopped ? "PREVIEW_CHILD_EXITED" : null, fetchImpl: async (url) => { if (url.endsWith("/live")) { stopped = true; return response(200, { status: "live" }); } return response(503, { status: "not_ready" }); } });
  assert.equal(result.failedEndpoint, "ready");
  assert.equal(result.live.contractResult, "pass");
  assert.equal(result.ready.failureCode, "PREVIEW_CHILD_EXITED");
});
