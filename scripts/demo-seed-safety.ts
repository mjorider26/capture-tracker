const requiredMode = "demo";
const requiredConfirmation = "CAPTURE_TRACKER_DEMO_ONLY";

function requireSafeFictionalStagingDatabase(): string | undefined {
  if (process.env.CAPTURE_TRACKER_STAGING_BOOTSTRAP !== "true") return undefined;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (process.env.CAPTURE_TRACKER_ENVIRONMENT !== "staging" || process.env.CAPTURE_TRACKER_EXECUTION_CONTEXT !== "cloudflare" || process.env.CAPTURE_TRACKER_DEPLOYMENT_PROFILE !== "free-preview-cloudflare-neon" || process.env.CAPTURE_TRACKER_REAL_DATA_APPROVED !== "false" || process.env.CAPTURE_TRACKER_DATA_MODE !== "fictional" || !databaseUrl || databaseUrl !== process.env.CAPTURE_TRACKER_STAGING_DATABASE_URL || !databaseUrl.includes(".neon.tech") || !databaseUrl.includes("-pooler.") || !/[?&]sslmode=(?:require|verify-ca|verify-full)(?:&|$)/.test(databaseUrl)) {
    throw new Error("Fictional staging bootstrap target is not permitted.");
  }
  return databaseUrl;
}

function isLocalDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");

  return host === "localhost" || host === "::1" || host === "127.0.0.1";
}

export function requireSafeDemoDatabase(): string {
  const fictionalStagingUrl = requireSafeFictionalStagingDatabase();
  if (fictionalStagingUrl) return fictionalStagingUrl;
  if (process.env.CAPTURE_TRACKER_DATA_MODE !== requiredMode) {
    throw new Error(
      "Demo data is blocked. Set CAPTURE_TRACKER_DATA_MODE=demo explicitly.",
    );
  }

  if (process.env.DEMO_SEED_CONFIRMATION !== requiredConfirmation) {
    throw new Error(
      "Demo data is blocked. Set DEMO_SEED_CONFIRMATION=CAPTURE_TRACKER_DEMO_ONLY explicitly.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for demo data operations.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid database URL.");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error("DATABASE_URL must use a PostgreSQL URL.");
  }

  if (!isLocalDatabaseHost(parsedUrl.hostname)) {
    throw new Error(
      "Demo data is blocked because DATABASE_URL must use a local database host.",
    );
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname).replace(
    /^\//,
    "",
  );
  if (!databaseName || /(?:test|integration|shadow)/i.test(databaseName)) {
    throw new Error(
      "Demo data is blocked because DATABASE_URL must name the normal local development database.",
    );
  }

  return databaseUrl;
}
