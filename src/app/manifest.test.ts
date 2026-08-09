import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("Capture Tracker manifest", () => {
  it("declares a standalone, scoped app with the canonical brand assets", () => {
    const value = manifest();
    expect(value.name).toBe("Capture Tracker"); expect(value.display).toBe("standalone"); expect(value.start_url).toBe("/app/today"); expect(value.icons?.map((icon) => icon.src)).toContain("/brand/capture-tracker-icon.png");
  });
});
