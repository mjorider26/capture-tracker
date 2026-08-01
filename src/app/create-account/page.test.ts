import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("practice-account create page", () => {
  it("keeps successful signup on the sign-in flow", async () => {
    const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).toContain('"Your practice account was created. Sign in to continue."');
    expect(source).toContain('"Your practice account is ready. Sign in to continue."');
    expect(source).toContain('window.location.assign("/sign-in?created=1")');
    expect(source).not.toContain('router.replace("/app")');
  });
});
