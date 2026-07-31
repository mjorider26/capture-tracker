import { describe, expect, it } from "vitest";

import { hashWorkerdPassword, verifyWorkerdPassword } from "./workerd-password";

describe("Workerd password hashing", () => {
  it("verifies a hash with the correct password and rejects a different password", async () => {
    const hash = await hashWorkerdPassword("fictional-practice-password");

    await expect(verifyWorkerdPassword(hash, "fictional-practice-password")).resolves.toBe(true);
    await expect(verifyWorkerdPassword(hash, "different-fictional-password")).resolves.toBe(false);
  });
});
