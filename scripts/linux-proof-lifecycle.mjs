import { spawn, spawnSync } from "node:child_process";

const MAX_CAPTURED_OUTPUT_BYTES = 16 * 1024;

function appendOutput(current, chunk) {
  if (current.length >= MAX_CAPTURED_OUTPUT_BYTES) return current;
  return `${current}${String(chunk)}`.slice(0, MAX_CAPTURED_OUTPUT_BYTES);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function completion(child) {
  return new Promise((resolve) => {
    child.once("close", (exitCode, signal) => resolve({ exitCode, signal }));
    child.once("error", (error) => resolve({ exitCode: null, signal: null, error }));
  });
}

export function logStage(stage, message) {
  console.log(`[${new Date().toISOString()}] ${stage}: ${message}`);
}

export function startManagedProcess({ command, args, cwd, env, spawnImpl = spawn }) {
  const child = spawnImpl(command, args, {
    cwd,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout = appendOutput(stdout, chunk); });
  child.stderr?.on("data", (chunk) => { stderr = appendOutput(stderr, chunk); });
  return { child, completion: completion(child), output: () => `${stdout}\n${stderr}`, stdout: () => stdout, stderr: () => stderr };
}

export async function stopManagedProcess(managed, { graceMs = 1_000, closeMs = 3_000 } = {}) {
  const { child } = managed;
  if (child.exitCode !== null || child.killed) return { stopped: true, forced: false };
  const terminate = (signal) => {
    try {
      child.kill(signal);
      if (process.platform === "win32") spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", timeout: 1_000 });
      else process.kill(-child.pid, signal);
    } catch {
      try { child.kill(signal); } catch { /* The process exited between checks. */ }
    }
  };
  terminate("SIGTERM");
  const graceful = await Promise.race([managed.completion, sleep(graceMs).then(() => null)]);
  if (graceful) return { stopped: true, forced: false };
  terminate("SIGKILL");
  await Promise.race([managed.completion, sleep(closeMs)]);
  return { stopped: true, forced: true };
}

export async function runBoundedCommand({ stage, command, args, cwd, env, timeoutMs, spawnImpl = spawn }) {
  logStage(stage, `starting (timeout=${timeoutMs}ms)`);
  const managed = startManagedProcess({ command, args, cwd, env, spawnImpl });
  const result = await Promise.race([
    managed.completion,
    sleep(timeoutMs).then(() => ({ timedOut: true })),
  ]);
  if (result?.timedOut) {
    const cleanup = await stopManagedProcess(managed);
    logStage(stage, `timed out; cleanup forced=${cleanup.forced}`);
    return { result: "timeout", exitCode: null, signal: null, stdout: managed.stdout(), stderr: managed.stderr(), output: managed.output(), cleanup };
  }
  logStage(stage, `completed exitCode=${result.exitCode ?? "null"} signal=${result.signal ?? "none"}`);
  return { result: result.exitCode === 0 ? "pass" : "fail", exitCode: result.exitCode, signal: result.signal, stdout: managed.stdout(), stderr: managed.stderr(), output: managed.output(), cleanup: { stopped: true, forced: false } };
}

export async function fetchWithTimeout(url, { timeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function pollHealth({ url, attempts, requestTimeoutMs, intervalMs, fetchImpl = fetch, stopWhen = null }) {
  let lastStatus = null;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const stop = stopWhen?.();
    if (stop) return { result: "fail", attempts: attempt - 1, status: lastStatus, error: stop };
    try {
      const response = await fetchWithTimeout(url, { timeoutMs: requestTimeoutMs, fetchImpl });
      lastStatus = response.status;
      if (response.status === 200) return { result: "pass", attempts: attempt, status: lastStatus, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.name : "request-failed";
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  return { result: "fail", attempts, status: lastStatus, error: lastError ?? "health-not-ready" };
}
