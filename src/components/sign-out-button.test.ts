import { describe, expect, it, vi } from "vitest";

import { signOutWithAuthClient } from "./sign-out-button";

describe("sign out", () => {
  it("uses Better Auth's generated client sign-out lifecycle", async () => {
    const onSuccess = vi.fn();
    const signOut = vi.fn().mockResolvedValue({ data: { success: true } });

    await expect(signOutWithAuthClient({ signOut } as never, onSuccess)).resolves.toBe(true);
    expect(signOut).toHaveBeenCalledWith({
      fetchOptions: { onSuccess },
    });
  });

  it("reports a failed Better Auth response without exposing auth details", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { code: "SAFE_ERROR" } });

    await expect(signOutWithAuthClient({ signOut } as never, vi.fn())).resolves.toBe(false);
  });
});
