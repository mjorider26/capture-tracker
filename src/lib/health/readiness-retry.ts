export const readinessRetryDelayMs = 150;

type ReadinessError = { code?: unknown; name?: unknown };

export function isTransientReadinessFailure(error: unknown) {
  const candidate = error as ReadinessError | null;
  return ["P1001", "P1017", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(
    typeof candidate?.code === "string" ? candidate.code : "",
  ) || candidate?.name === "TimeoutError";
}

type ReadinessAttempt = () => Promise<void>;

export async function runReadinessWithRetry({
  firstAttempt,
  retryAttempt,
  sleep = (delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
}: {
  firstAttempt: ReadinessAttempt;
  retryAttempt: ReadinessAttempt;
  sleep?: (delayMs: number) => Promise<void>;
}) {
  try {
    await firstAttempt();
  } catch (error) {
    if (!isTransientReadinessFailure(error)) throw error;

    await sleep(readinessRetryDelayMs);
    await retryAttempt();
  }
}
