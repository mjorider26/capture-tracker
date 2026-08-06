import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("sign-in page", () => {
  it("uses the official Better Auth email sign-in client and separates production copy", async () => {
    const source = await readFile(new URL("../../components/sign-in-form.tsx", import.meta.url), "utf8");

    expect(source).toContain("authClient.signIn.email");
    expect(source).not.toContain('fetch("/api/auth/sign-in/email"');
    expect(source).toContain("Sign in to your private Capture Tracker workspace.");
    expect(source).toContain('href="/create-account"');
  });
});
