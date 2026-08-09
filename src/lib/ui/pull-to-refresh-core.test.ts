import { describe, expect, it } from "vitest";
import { maxPullDistance, pullState, resistedPullDistance, shouldStartPull } from "./pull-to-refresh-core";

describe("pull-to-refresh gesture core", () => {
  const eligible = { scrollY: 0, startX: 20, startY: 20, targetIsInteractive: false, dialogOpen: false, refreshing: false };
  it("only begins at the top when no protected interaction is active", () => {
    expect(shouldStartPull(eligible)).toBe(true);
    expect(shouldStartPull({ ...eligible, scrollY: 2 })).toBe(false);
    expect(shouldStartPull({ ...eligible, targetIsInteractive: true })).toBe(false);
    expect(shouldStartPull({ ...eligible, dialogOpen: true })).toBe(false);
    expect(shouldStartPull({ ...eligible, refreshing: true })).toBe(false);
  });
  it("ignores upward pulls and arms only after the resisted threshold", () => {
    expect(pullState(-20)).toBe("idle");
    expect(pullState(30)).toBe("pulling");
    expect(pullState(120)).toBe("armed");
  });
  it("caps visual pull distance to avoid a giant rubber band", () => {
    expect(resistedPullDistance(10_000)).toBe(maxPullDistance);
  });
});
