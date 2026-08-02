import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Today glass treatment", () => {
  it("keeps the key Today surfaces translucent with a safe blur fallback", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).toContain(".today-cash-stage");
    expect(css).toContain(".today-planning-rail");
    expect(css).toContain(".today-priority-zone");
    expect(css).toContain(".today-allocation");
    expect(css).toContain("@apply backdrop-filter");
    expect(css).toContain("--tw-backdrop-blur: blur(20px)");
    expect(css).toContain("@supports not (backdrop-filter: blur(1px))");
  });
});
