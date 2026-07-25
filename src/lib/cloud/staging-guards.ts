import { CloudConfigurationError, readCloudEnvironment } from "./environment";

type EnvironmentInput = Record<string, string | undefined>;

export const fictionalStagingBootstrapConfirmation = "BOOTSTRAP_FICTIONAL_STAGING";
export const fictionalStagingMigrationConfirmation = "CAPTURE_TRACKER_STAGING_MIGRATE";

function commandConfirmation(argv: readonly string[], expected: string) {
  return argv.includes(`--confirm=${expected}`) || argv.includes(expected);
}

export function assertFictionalStagingBootstrap(input: EnvironmentInput = process.env, argv: readonly string[] = process.argv) {
  const config = readCloudEnvironment(input);
  if (config.deploymentProfile !== "free-preview-cloudflare-neon" || config.environment !== "staging" || config.executionContext !== "cloudflare" || config.realDataApproved) {
    throw new CloudConfigurationError("Fictional staging bootstrap is unavailable for this target.");
  }
  if (!commandConfirmation(argv, fictionalStagingBootstrapConfirmation)) throw new CloudConfigurationError("Fictional staging bootstrap confirmation is required.");
  const email = input.CAPTURE_TRACKER_FICTIONAL_LOGIN_EMAIL?.trim();
  const password = input.CAPTURE_TRACKER_FICTIONAL_LOGIN_PASSWORD;
  if (!email?.endsWith(".demo") || !password || password.length < 12) throw new CloudConfigurationError("Secure runtime fictional login input is required.");
  return { config, email, password };
}

export function assertCloudMigration(input: EnvironmentInput = process.env) {
  const config = readCloudEnvironment(input);
  if (config.deploymentProfile !== "free-preview-cloudflare-neon" || config.environment !== "staging" || config.executionContext !== "cloudflare" || config.realDataApproved) {
    throw new CloudConfigurationError("Cloud migrations are limited to confirmed fictional staging.");
  }
  if (input.CAPTURE_TRACKER_CLOUD_MIGRATION_CONFIRMATION !== fictionalStagingMigrationConfirmation) throw new CloudConfigurationError("Cloud migration confirmation is missing.");
  if (!config.migrationDatabaseUrl || !config.runtimeDatabaseUrl || config.migrationDatabaseUrl === config.runtimeDatabaseUrl || config.migrationDatabaseUrl.includes("-pooler.")) {
    throw new CloudConfigurationError("A direct Neon migration target is required.");
  }
  return config;
}
