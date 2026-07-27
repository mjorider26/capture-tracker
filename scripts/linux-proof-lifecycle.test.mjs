import assert from "node:assert/strict";
import test from "node:test";
import { runBoundedCommand, startManagedProcess, stopManagedProcess, pollHealth } from "./linux-proof-lifecycle.mjs";

const node = process.execPath;
const cwd = process.cwd();

test("bounded command completes and drains output", async () => {
  const result = await runBoundedCommand({ stage: "test-success", command: node, args: ["-e", "console.log('fictional-success')"], cwd, env: process.env, timeoutMs: 2_000 });
  assert.equal(result.result, "pass");
  assert.match(result.output, /fictional-success/);
});

test("long-running command times out and leaves no child process", async () => {
  const result = await runBoundedCommand({ stage: "test-timeout", command: node, args: ["-e", "setInterval(() => {}, 1000)"], cwd, env: process.env, timeoutMs: 150 });
  assert.equal(result.result, "timeout");
  assert.equal(result.cleanup.stopped, true);
});

test("managed cleanup is harmless after natural success", async () => {
  const managed = startManagedProcess({ command: node, args: ["-e", "console.log('fictional-natural-success')"], cwd, env: process.env });
  await managed.completion;
  const cleanup = await stopManagedProcess(managed);
  assert.deepEqual(cleanup, { stopped: true, forced: false });
});

test("managed cleanup runs after an explicit failure path", async () => {
  const managed = startManagedProcess({ command: node, args: ["-e", "setInterval(() => {}, 1000)"], cwd, env: process.env });
  try {
    throw new Error("simulated-preview-failure");
  } catch (error) {
    assert.match(error.message, /simulated-preview-failure/);
  } finally {
    const cleanup = await stopManagedProcess(managed, { graceMs: 100, closeMs: 1_000 });
    assert.equal(cleanup.stopped, true);
  }
  assert.equal(managed.child.killed, true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.throws(() => process.kill(managed.child.pid, 0), { code: "ESRCH" });
});

test("health polling succeeds within bounded attempts", async () => {
  let attempts = 0;
  const result = await pollHealth({
    url: "http://127.0.0.1/fictional",
    attempts: 3,
    requestTimeoutMs: 100,
    intervalMs: 1,
    fetchImpl: async () => ({ status: ++attempts === 2 ? 200 : 503 }),
  });
  assert.deepEqual(result, { result: "pass", attempts: 2, status: 200, error: null });
});

test("health polling stops at its deadline", async () => {
  const result = await pollHealth({
    url: "http://127.0.0.1/fictional",
    attempts: 2,
    requestTimeoutMs: 10,
    intervalMs: 1,
    fetchImpl: async () => { throw new Error("not-ready"); },
  });
  assert.equal(result.result, "fail");
  assert.equal(result.attempts, 2);
});
