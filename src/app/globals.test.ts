import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Guided owner responsive treatment", () => {
  it("keeps mobile navigation, owner tools, and reduced-motion safeguards explicit", async () => {
    const css = await readFile(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).toContain(".book-status-stage");
    expect(css).toContain(".owner-quick-actions");
    expect(css).toContain(".workspace-tools");
    expect(css).toContain(".workspace-dialog-panel");
    expect(css).toContain(".guided-report-library");
    expect(css).toContain(".mobile-shell-nav");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
