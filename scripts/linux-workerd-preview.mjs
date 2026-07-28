export function cleanWorkerdEnvironment() {
  const environment = { ...process.env };
  for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET", "CAPTURE_TRACKER_STAGING_DATABASE_URL", "CAPTURE_TRACKER_STAGING_DIRECT_DATABASE_URL"]) delete environment[key];
  Object.assign(environment, { CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", CI: "true", CAPTURE_TRACKER_ENVIRONMENT: "staging", CAPTURE_TRACKER_EXECUTION_CONTEXT: "cloudflare", CAPTURE_TRACKER_DEPLOYMENT_PROFILE: "free-preview-cloudflare-neon", CAPTURE_TRACKER_REAL_DATA_APPROVED: "false", CAPTURE_TRACKER_PAID_SERVICE_APPROVED: "false", CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED: "false", CAPTURE_TRACKER_DATA_MODE: "fictional" });
  return environment;
}

export function workerdPreviewArgs(port) {
  return ["wrangler", "dev", "--local", "--config", "wrangler.jsonc", "--ip", "127.0.0.1", "--port", String(port), "--persist-to", ".artifacts/workerd-state"];
}
