import { describe, expect, it } from "vitest";

import { landingOnboardingPresentation } from "./onboarding-presentation";

const staging = {
  CAPTURE_TRACKER_ENVIRONMENT: "staging",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon",
  CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
};

const production = {
  CAPTURE_TRACKER_ENVIRONMENT: "production",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-cloudflare-neon",
};

describe("landing onboarding presentation", () => {
  it("keeps fictional staging wording and the practice-account CTA in staging", () => {
    const presentation = landingOnboardingPresentation(staging);

    expect(presentation.notice).toContain("fictional staging environment");
    expect(presentation.accountCreationLabel).toBe("Create practice account");
  });

  it("uses first-owner production wording when controlled onboarding is enabled and the workspace is empty", () => {
    const presentation = landingOnboardingPresentation({
      ...production,
      CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "true",
      CAPTURE_TRACKER_DATA_MODE: "fictional",
    }, true);

    expect(presentation.notice).toContain("first owner account");
    expect(presentation.notice).not.toContain("invitation");
    expect(presentation.accountCreationLabel).toBe("Create account");
    expect(presentation.notice).not.toContain("staging");
    expect(presentation.accountCreationLabel).not.toContain("practice");
  });

  it("closes production account creation when onboarding is disabled", () => {
    const presentation = landingOnboardingPresentation({
      ...production,
      CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
      CAPTURE_TRACKER_DATA_MODE: "fictional",
    });

    expect(presentation.accountCreationAvailable).toBe(false);
    expect(presentation.accountCreationLabel).toBeUndefined();
    expect(presentation.notice).toContain("already been set up");
    expect(presentation.notice).not.toContain("staging");
    expect(presentation.notice).not.toContain("practice-account");
  });
});
