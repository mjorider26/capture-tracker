import { describe, expect, it, vi } from "vitest";

import { requestSignOut } from "./sign-out-button";

describe("sign out", () => {
  it("uses the existing Better Auth sign-out endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await expect(requestSignOut(fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith("/api/auth/sign-out", {
      method: "POST",
    });
  });
});
