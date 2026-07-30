import { describe, expect, it } from "vitest";

import {
  isFictionalStagingPracticeSignupEnabled,
  practiceBusinessId,
  validatePracticeAccountInput,
} from "./staging-practice-account-core";

const testInvitation = "fixture-invitation-code";

function fictionalStagingEnvironment(
  overrides: Record<string, string | undefined> = {},
) {
  const runtimeUrl = "postgresql://fixture:fixture@capture-tracker-staging-pooler.us-east-1.aws.neon.tech/capture_tracker_staging?sslmode=require";
  return {
    CAPTURE_TRACKER_ENVIRONMENT: "staging",
    CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare",
    CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon",
    CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
    CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false",
    CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
    CAPTURE_TRACKER_DATA_MODE: "fictional",
    CAPTURE_TRACKER_STAGING_DATABASE_NAME: "capture_tracker_staging",
    CAPTURE_TRACKER_STAGING_DATABASE_URL: runtimeUrl,
    CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: "postgresql://fixture:fixture@capture-tracker-staging.us-east-1.aws.neon.tech/capture_tracker_staging?sslmode=require",
    DATABASE_URL: runtimeUrl,
    CAPTURE_TRACKER_STAGING_INVITATION_CODE: testInvitation,
    ...overrides,
  };
}

const validInput = {
  name: "Practice Owner",
  email: "practice.owner@example.test",
  password: "correct-horse-battery-staple",
  confirmPassword: "correct-horse-battery-staple",
  invitationCode: testInvitation,
};

describe("fictional staging practice-account guard", () => {
  it("fails closed when the invitation code is missing or incorrect", async () => {
    await expect(
      validatePracticeAccountInput(
        validInput,
        fictionalStagingEnvironment({
          CAPTURE_TRACKER_STAGING_INVITATION_CODE: undefined,
        }),
      ),
    ).resolves.toBeNull();

    await expect(
      validatePracticeAccountInput(
        { ...validInput, invitationCode: "incorrect-code" },
        fictionalStagingEnvironment(),
      ),
    ).resolves.toBeNull();
  });

  it("accepts a valid fictional-staging request without returning the invitation", async () => {
    const result = await validatePracticeAccountInput(
      validInput,
      fictionalStagingEnvironment(),
    );

    expect(result).toMatchObject({
      name: "Practice Owner",
      email: "practice.owner@example.test",
    });
    expect(result).not.toHaveProperty("configuredInvitationCode");
  });

  it("keeps production registration disabled even with an invitation configured", () => {
    const production = fictionalStagingEnvironment({
      CAPTURE_TRACKER_ENVIRONMENT: "production",
      CAPTURE_TRACKER_EXECUTION_CONTEXT: "aws",
      CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-secure-aws",
    });

    expect(isFictionalStagingPracticeSignupEnabled(production)).toBe(false);
  });

  it("uses a deterministic business id for safe provisioning retries", () => {
    expect(practiceBusinessId("user-one")).toBe("practice-user-one");
  });
});
