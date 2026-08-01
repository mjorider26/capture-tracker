import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("sign-in page", () => {
  it("uses the official Better Auth email sign-in client", async () => {
    const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain("authClient.signIn.email");
    expect(source).not.toContain('fetch("/api/auth/sign-in/email"');
  });
});
