import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Today glass treatment", () => {
  it("keeps the key Today surfaces visibly translucent with a safe blur fallback", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).toContain(".today-cash-stage");
    expect(css).toContain(".today-planning-rail");
    expect(css).toContain(".today-priority-zone");
    expect(css).toContain(".today-allocation");
    expect(css).toContain("@apply backdrop-filter");
    expect(css).toContain("--tw-backdrop-blur: blur(20px)");
    expect(css).toContain("@supports not (backdrop-filter: blur(1px))");
    expect(css).toContain("--glass-primary: rgba(7, 22, 34, 0.68)");
    expect(css).toContain("--glass-secondary: rgba(12, 36, 52, 0.56)");
    expect(css).toContain("--glass-blur-desktop: blur(22px) saturate(128%)");
    expect(css).toContain("--glass-blur-mobile: blur(14px) saturate(118%)");
    expect(css).toContain("rgba(133, 100, 224, 0.08)");
    expect(css).toContain(".mobile-shell-nav");
  });
});
