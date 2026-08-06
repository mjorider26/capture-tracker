import { describe, expect, it } from "vitest";
import { deploymentKind, signInPresentation } from "./sign-in-presentation";

describe("server sign-in presentation", () => {
  it("never maps production availability failures to staging wording", () => {
    const production = signInPresentation("production", "unknown");
    expect(production.notice).toBe("Sign in to your private Capture Tracker workspace.");
    expect(production.showCreateAccount).toBe(false);
    expect(JSON.stringify(production)).not.toMatch(/fictional staging|practice account/i);
  });
  it("shows setup only for an available production bootstrap and retains staging copy", () => {
    expect(signInPresentation("production", "available").showCreateAccount).toBe(true);
    expect(signInPresentation("production", "initialized").showCreateAccount).toBe(false);
    expect(signInPresentation("staging", "initialized").notice).toContain("fictional staging account");
    expect(deploymentKind({ CAPTURE_TRACKER_ENVIRONMENT: "production", CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-cloudflare-neon" })).toBe("production");
  });
});
