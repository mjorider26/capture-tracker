import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("production bootstrap create page", () => {
  it("keeps successful bootstrap signup on the sign-in flow without an invitation field", async () => {
    const source = await readFile(new URL("../../components/create-account-form.tsx", import.meta.url), "utf8");

    expect(source).toContain("Your account was created. Sign in to continue.");
    expect(source).toContain('fetch("/api/invitations/create-account"');
    expect(source).toContain('href="/sign-in?created=1"');
    expect(source).not.toContain("invitationCode");
  });
});
