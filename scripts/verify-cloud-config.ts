import { assertRealDataPermitted, publicRuntimeConfiguration, readCloudEnvironment } from "../src/lib/cloud/environment";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function rejects(input: Record<string, string | undefined>) {
  try {
    readCloudEnvironment(input);
    return false;
  } catch {
    return true;
  }
}

const neonRuntime = "postgresql://user:password@ep-example-123-pooler.us-east-2.aws.neon.tech:5432/capture_tracker_staging?sslmode=require";
const neonMigration = "postgresql://user:password@ep-example-123.us-east-2.aws.neon.tech:5432/capture_tracker_staging?sslmode=require";
const freePreview = {
  CAPTURE_TRACKER_ENVIRONMENT: "staging",
  CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon",
  CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
  CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false",
  CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false",
  CAPTURE_TRACKER_DATA_MODE: "fictional",
  CAPTURE_TRACKER_STAGING_DATABASE_URL: neonRuntime,
  CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: neonMigration,
  CAPTURE_TRACKER_STAGING_DATABASE_NAME: "capture_tracker_staging",
};
const awsProduction = {
  CAPTURE_TRACKER_ENVIRONMENT: "production",
  CAPTURE_TRACKER_EXECUTION_CONTEXT: "aws",
  CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "production-secure-aws",
  CAPTURE_TRACKER_REAL_DATA_APPROVED: "false",
  CAPTURE_TRACKER_PRODUCTION_DATABASE_URL: "postgresql://user:password@database.internal:5432/capture_tracker_production?sslmode=require",
  CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL: "postgresql://migration:password@database-migrations.internal:5432/capture_tracker_production?sslmode=require",
  CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME: "capture_tracker_production",
  CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET: "capture-tracker-production-documents",
  CAPTURE_TRACKER_PRODUCTION_KMS_KEY_ARN: "arn:aws:kms:us-west-2:example:key/example",
  CAPTURE_TRACKER_PRODUCTION_SECRET_ARN: "arn:aws:secretsmanager:us-west-2:example:secret:capture-tracker-production",
};

assert(readCloudEnvironment({ DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/capture_tracker" }).deploymentProfile === "no-deploy", "Local configuration must default to no-deploy.");
const previewConfig = readCloudEnvironment(freePreview);
assert(previewConfig.runtimeDatabaseUrl === neonRuntime && previewConfig.migrationDatabaseUrl === neonMigration, "Free preview must retain separate pooled runtime and direct migration URLs.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_ENVIRONMENT: "production" }), "Free preview cannot target production.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_REAL_DATA_APPROVED: "true" }), "Free preview cannot enable real data.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "true" }), "Free preview cannot activate paid services.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "true" }), "Free preview cannot enable customer onboarding.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_DATA_MODE: "demo" }), "Free preview must use fictional data mode.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_STAGING_DATABASE_URL: "postgresql://u:p@localhost:5432/capture_tracker_staging?sslmode=require" }), "Free preview must reject localhost databases.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_STAGING_DATABASE_URL: "postgresql://u:p@ep-example-123-pooler.us-east-2.aws.neon.tech:5432/capture_tracker_staging" }), "Free preview must require Neon TLS.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_STAGING_DATABASE_URL: neonMigration }), "Free preview runtime must use a Neon pooled connection.");
assert(rejects({ ...freePreview, CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL: neonRuntime }), "Free preview migrations must use a distinct direct connection.");
assert(readCloudEnvironment(awsProduction).environment === "production", "Synthetic AWS production profile must parse without real-data approval.");
assert(rejects({ ...awsProduction, CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare" }), "AWS production profile cannot run in Cloudflare.");
assert(rejects({ ...awsProduction, CAPTURE_TRACKER_PRODUCTION_DATABASE_URL: "postgresql://u:p@localhost:5432/capture_tracker_production?sslmode=require" }), "AWS profile must reject localhost databases.");
try {
  assertRealDataPermitted(awsProduction);
  throw new Error("Missing real-data approval must reject.");
} catch (error) {
  assert(error instanceof Error && error.message === "Real data is not approved for this execution context.", "Approval error must be sanitized.");
}
assert(assertRealDataPermitted({ ...awsProduction, CAPTURE_TRACKER_REAL_DATA_APPROVED: "true" }).realDataApproved, "Explicit AWS production approval must be recognized.");
assert(!JSON.stringify(publicRuntimeConfiguration()).match(/DATABASE_URL|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|TOKEN/), "Public configuration must contain no server secrets.");
assert(previewConfig.documentBucket === undefined, "Fictional staging must not configure an R2 bucket.");
console.log("CLOUD CONFIGURATION VERIFIED: no-deploy default, fictional Cloudflare/Neon staging without R2, guarded direct migrations, and optional AWS profile assertions passed.");
