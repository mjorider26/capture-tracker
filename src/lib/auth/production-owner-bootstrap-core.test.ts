import { describe, expect, it } from "vitest";
import { isProductionOwnerBootstrapEnabled, validateProductionBootstrapInput } from "./production-owner-bootstrap-core";

const production = { CAPTURE_TRACKER_ENVIRONMENT: "production", CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare", CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-cloudflare-neon", CAPTURE_TRACKER_REAL_DATA_APPROVED: "true", CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "true", CAPTURE_TRACKER_DATA_MODE: "production", CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME: "capture_tracker_production" };

describe("production first-owner bootstrap guard", () => {
  it("requires the approved production boundary and accepts no invitation field", () => {
    expect(isProductionOwnerBootstrapEnabled(production)).toBe(true);
    expect(isProductionOwnerBootstrapEnabled({ ...production, CAPTURE_TRACKER_REAL_DATA_APPROVED: "false" })).toBe(false);
    expect(validateProductionBootstrapInput({ name: "Owner", email: "owner@example.test", password: "correct-horse-battery-staple", confirmPassword: "correct-horse-battery-staple" })).toMatchObject({ email: "owner@example.test" });
  });
});
