import { describe, expect, it } from "vitest";

import {
  assertCleanupEnvironment,
  assertDirectProductionUrl,
  assertExecutionIntent,
  assertTenantIdentity,
  productionAcceptance,
  reservedBusinessId,
} from "../../../scripts/production-acceptance-cleanup-core";

const environment = {
  CAPTURE_TRACKER_ENVIRONMENT: "production",
  CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-cloudflare-neon",
  CAPTURE_TRACKER_DATA_MODE: "fictional",
  CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
  CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
  CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME: productionAcceptance.database,
  CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET: productionAcceptance.bucket,
  CAPTURE_TRACKER_CLEANUP_AUTHORIZATION: productionAcceptance.authorization,
};

describe("production fictional acceptance cleanup guards", () => {
  it("accepts only the explicit fictional production configuration", () => {
    expect(() => assertCleanupEnvironment(environment)).not.toThrow();
    expect(() => assertCleanupEnvironment({ ...environment, CAPTURE_TRACKER_REAL_DATA_APPROVED: "true" })).toThrow("REAL_DATA_REFUSED");
    expect(() => assertCleanupEnvironment({ ...environment, CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "true" })).toThrow("ONBOARDING_REFUSED");
    expect(() => assertCleanupEnvironment({ ...environment, CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME: "other" })).toThrow("DATABASE_NAME_REFUSED");
    expect(() => assertCleanupEnvironment({ ...environment, CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET: "other" })).toThrow("R2_BUCKET_REFUSED");
  });

  it("requires an unpooled TLS production target and explicit execution confirmation", () => {
    const database = ["capture_tracker", "production"].join("_");
    expect(() => assertDirectProductionUrl(`postgresql://user:password@ep-example.us-west-2.aws.neon.tech/${database}?sslmode=require`)).not.toThrow();
    expect(() => assertDirectProductionUrl(`postgresql://user:password@ep-example-pooler.us-west-2.aws.neon.tech/${database}?sslmode=require`)).toThrow("DIRECT_DATABASE_URL_HOST_REFUSED");
    expect(() => assertExecutionIntent(["--execute", `--confirm=${productionAcceptance.confirmation}`])).not.toThrow();
    expect(() => assertExecutionIntent(["--execute", "--confirm=wrong"])).toThrow("CONFIRMATION_REFUSED");
  });

  it("refuses a reserved user with another business membership", () => {
    const user = { id: "fictional-user", email: productionAcceptance.email, displayName: productionAcceptance.displayName };
    const business = { id: reservedBusinessId(user.id), legalName: productionAcceptance.businessName, displayName: productionAcceptance.businessName };
    expect(() => assertTenantIdentity({ user, business, memberships: [{ businessId: business.id }, { businessId: "unrelated" }] })).toThrow("CROSS_TENANT_MEMBERSHIP_REFUSED");
  });
});
