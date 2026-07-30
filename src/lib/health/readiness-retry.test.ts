import { describe, expect, it, vi } from "vitest";

import { runReadinessWithRetry } from "./readiness-retry";

describe("runReadinessWithRetry", () => {
  it("succeeds without retrying when the initial readiness query succeeds", async () => {
    const firstAttempt = vi.fn(async () => undefined);
    const retryAttempt = vi.fn(async () => undefined);

    await runReadinessWithRetry({ firstAttempt, retryAttempt });

    expect(firstAttempt).toHaveBeenCalledTimes(1);
    expect(retryAttempt).not.toHaveBeenCalled();
  });

  it("retries once with a fresh attempt after a recognized transient connection failure", async () => {
    const firstAttempt = vi.fn(async () => {
      throw Object.assign(new Error("connection lost"), { code: "P1017" });
    });
    const retryAttempt = vi.fn(async () => undefined);
    const sleep = vi.fn(async () => undefined);

    await runReadinessWithRetry({ firstAttempt, retryAttempt, sleep });

    expect(firstAttempt).toHaveBeenCalledTimes(1);
    expect(retryAttempt).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry permanent configuration failures", async () => {
    const failure = Object.assign(new Error("configuration unavailable"), { code: "CONFIGURATION" });
    const firstAttempt = vi.fn(async () => {
      throw failure;
    });
    const retryAttempt = vi.fn(async () => undefined);

    await expect(runReadinessWithRetry({ firstAttempt, retryAttempt })).rejects.toBe(failure);

    expect(firstAttempt).toHaveBeenCalledTimes(1);
    expect(retryAttempt).not.toHaveBeenCalled();
  });

  it("stops after the bounded retry attempt fails", async () => {
    const firstAttempt = vi.fn(async () => {
      throw Object.assign(new Error("connection timed out"), { code: "ETIMEDOUT" });
    });
    const retryFailure = Object.assign(new Error("connection still unavailable"), { code: "P1001" });
    const retryAttempt = vi.fn(async () => {
      throw retryFailure;
    });

    await expect(
      runReadinessWithRetry({ firstAttempt, retryAttempt, sleep: async () => undefined }),
    ).rejects.toBe(retryFailure);

    expect(firstAttempt).toHaveBeenCalledTimes(1);
    expect(retryAttempt).toHaveBeenCalledTimes(1);
  });
});
