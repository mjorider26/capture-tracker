import { describe, expect, it } from "vitest";

describe("authenticated application layout", () => {
  it("keeps the shared layout free of a duplicate business-context lookup", async () => {
    const { default: ApplicationLayout } = await import("./layout");

    expect(ApplicationLayout({ children: "content" })).toBe("content");
  });
});
