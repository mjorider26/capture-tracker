const environments = ["local", "test", "staging", "production"] as const;
const contexts = ["local", "ci", "cloudflare", "aws"] as const;
const deploymentProfiles = ["no-deploy", "free-preview-cloudflare-neon", "production-secure-aws"] as const;

export type CaptureTrackerEnvironment = (typeof environments)[number];
export type ExecutionContext = (typeof contexts)[number];
export type DeploymentProfile = (typeof deploymentProfiles)[number];

export class CloudConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudConfigurationError";
  }
}

type EnvironmentInput = Record<string, string | undefined>;

function value(input: EnvironmentInput, name: string) {
  return input[name]?.trim() || undefined;
}

function oneOf<T extends readonly string[]>(valueToCheck: string | undefined, allowed: T, label: string, fallback: T[number]): T[number] {
  const selected = valueToCheck ?? fallback;
  if (!allowed.includes(selected)) throw new CloudConfigurationError(`${label} is invalid.`);
  return selected as T[number];
}

function cloudName(name: string | undefined, label: string) {
  if (!name || !/^[a-z0-9][a-z0-9-]{2,62}$/i.test(name)) {
    throw new CloudConfigurationError(`${label} is not configured safely.`);
  }
  return name;
}

function validatePostgresTarget(connectionString: string, environment: "staging" | "production", expectedName: string) {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new CloudConfigurationError("Cloud database target is invalid.");
  }

  const host = parsed.hostname.toLowerCase();
  const databaseName = decodeURIComponent(parsed.pathname).replace(/^\//, "");
  const tls = parsed.searchParams.get("sslmode") ?? parsed.searchParams.get("ssl");
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !tls || !['require', 'verify-ca', 'verify-full', 'true'].includes(tls)) {
    throw new CloudConfigurationError("Cloud database must use PostgreSQL with TLS.");
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || host.includes("prisma")) {
    throw new CloudConfigurationError("Cloud database host is not permitted.");
  }
  if (databaseName !== expectedName) throw new CloudConfigurationError("Cloud database name is not permitted.");
  const prohibited = environment === "production" ? /demo|test|validation|integration|staging|default/i : /prod|production/i;
  if (prohibited.test(databaseName)) throw new CloudConfigurationError("Cloud database name crosses an environment boundary.");
  return parsed;
}

function requireExplicitFalse(input: EnvironmentInput, name: string, message: string) {
  if (value(input, name) !== "false") throw new CloudConfigurationError(message);
}

export function readCloudEnvironment(input: EnvironmentInput = process.env) {
  const environment = oneOf(value(input, "CAPTURE_TRACKER_ENVIRONMENT"), environments, "Capture Tracker environment", "local");
  const executionContext = oneOf(value(input, "CAPTURE_TRACKER_EXECUTION_CONTEXT"), contexts, "Capture Tracker execution context", "local");
  const deploymentProfile = oneOf(value(input, "CAPTURE_TRACKER_DEPLOYMENT_PROFILE"), deploymentProfiles, "Capture Tracker deployment profile", "no-deploy");
  const realDataApproved = value(input, "CAPTURE_TRACKER_REAL_DATA_APPROVED") === "true";
  const cloud = environment === "staging" || environment === "production";
  const runtimeDatabaseUrl = cloud ? value(input, environment === "staging" ? "CAPTURE_TRACKER_STAGING_DATABASE_URL" : "CAPTURE_TRACKER_PRODUCTION_DATABASE_URL") : value(input, "DATABASE_URL");
  const migrationDatabaseUrl = cloud ? value(input, environment === "staging" ? "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL" : "CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL") : undefined;
  const expectedDatabaseName = cloud ? value(input, environment === "staging" ? "CAPTURE_TRACKER_STAGING_DATABASE_NAME" : "CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME") : undefined;
  // R2 is deliberately absent from the fictional Cloudflare preview. A
  // private document bucket remains a production-only prerequisite.
  const documentBucket = environment === "production" ? cloudName(value(input, "CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET"), "Private document bucket") : undefined;

  if (!cloud) return { environment, executionContext, deploymentProfile, realDataApproved, runtimeDatabaseUrl, migrationDatabaseUrl, expectedDatabaseName, documentBucket };

  if (!expectedDatabaseName || !/^[a-z0-9_]{3,63}$/i.test(expectedDatabaseName)) throw new CloudConfigurationError("Cloud database name is not configured safely.");
  if (!runtimeDatabaseUrl || !migrationDatabaseUrl) throw new CloudConfigurationError("Separate runtime and migration database URLs are required.");
  // DATABASE_URL is an application-runtime secret, never cloud configuration
  // input. If present it must exactly mirror the explicit pooled runtime URL;
  // it can never be used as a local or migration fallback.
  if (value(input, "DATABASE_URL") && value(input, "DATABASE_URL") !== runtimeDatabaseUrl) {
    throw new CloudConfigurationError("DATABASE_URL cannot override the cloud runtime target.");
  }
  if (runtimeDatabaseUrl === migrationDatabaseUrl) throw new CloudConfigurationError("Runtime and migration database URLs must be distinct.");
  const runtimeTarget = validatePostgresTarget(runtimeDatabaseUrl, environment, expectedDatabaseName);
  const migrationTarget = validatePostgresTarget(migrationDatabaseUrl, environment, expectedDatabaseName);

  if (deploymentProfile === "free-preview-cloudflare-neon") {
    if (environment !== "staging" || executionContext !== "cloudflare") throw new CloudConfigurationError("Free preview is staging-only Cloudflare execution.");
    requireExplicitFalse(input, "CAPTURE_TRACKER_REAL_DATA_APPROVED", "Free preview must keep real-data approval false.");
    requireExplicitFalse(input, "CAPTURE_TRACKER_PAID_SERVICE_APPROVED", "Free preview cannot activate paid services.");
    requireExplicitFalse(input, "CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED", "Free preview cannot enable customer onboarding.");
    if (value(input, "CAPTURE_TRACKER_DATA_MODE") !== "fictional") throw new CloudConfigurationError("Free preview is fictional-data-only.");
    if (!runtimeTarget.hostname.endsWith(".neon.tech") || !migrationTarget.hostname.endsWith(".neon.tech") || !runtimeTarget.hostname.includes("-pooler.")) {
      throw new CloudConfigurationError("Free preview requires Neon pooled runtime and direct migration connections.");
    }
  }

  if (deploymentProfile === "production-secure-aws") {
    if (environment !== "production" || executionContext !== "aws") throw new CloudConfigurationError("AWS production profile is production-only.");
    if (!value(input, "CAPTURE_TRACKER_PRODUCTION_KMS_KEY_ARN")?.startsWith("arn:aws:kms:") || !value(input, "CAPTURE_TRACKER_PRODUCTION_SECRET_ARN")?.startsWith("arn:aws:secretsmanager:")) {
      throw new CloudConfigurationError("AWS production security resource reference is invalid.");
    }
  }

  if (deploymentProfile === "no-deploy" && executionContext !== "local" && executionContext !== "ci") {
    throw new CloudConfigurationError("Cloud execution requires an explicit deployment profile.");
  }
  if (realDataApproved && deploymentProfile !== "production-secure-aws") throw new CloudConfigurationError("Real data is not approved for this execution context.");

  return { environment, executionContext, deploymentProfile, realDataApproved, runtimeDatabaseUrl, migrationDatabaseUrl, expectedDatabaseName, documentBucket };
}

export function assertRealDataPermitted(input: EnvironmentInput = process.env) {
  const config = readCloudEnvironment(input);
  if (config.environment !== "production" || config.executionContext !== "aws" || config.deploymentProfile !== "production-secure-aws" || !config.realDataApproved) {
    throw new CloudConfigurationError("Real data is not approved for this execution context.");
  }
  return config;
}

export function publicRuntimeConfiguration() {
  return { applicationName: "Capture Tracker" };
}
