import { config } from "dotenv";
import pg from "pg";

const { Client } = pg;

export const fullPostgresDatabases = {
  admin: "postgres",
  validation: "capture_tracker_fullpg_validation",
  integration: "capture_tracker_fullpg_integration",
};

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function loadEnvironment() {
  // Explicit process values win; ignored local files only supply a fallback.
  config({ path: ".env", override: false, quiet: true });
  config({ path: ".env.full-postgres.local", override: false, quiet: true });
}

function parseUrl(value, variableName, databaseName) {
  if (!value) throw new Error(`${variableName} is required.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`);
  }

  const actualDatabase = decodeURIComponent(url.pathname).replace(/^\//, "");
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error(`${variableName} must use PostgreSQL.`);
  if (!localHosts.has(url.hostname.toLowerCase()))
    throw new Error(`${variableName} must target a local PostgreSQL host.`);
  if (Number(url.port || "5432") !== 5432)
    throw new Error(
      `${variableName} must target the discovered PostgreSQL port.`,
    );
  if (actualDatabase !== databaseName)
    throw new Error(`${variableName} must target ${databaseName}.`);
  return url;
}

export function sanitize(text) {
  return String(text)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[database-url-redacted]")
    .replace(/password=[^\s&]+/gi, "password=[redacted]")
    .replace(/\x1b\][^\x07]*\x07/g, "");
}

export function fullPostgresConfig() {
  loadEnvironment();
  const admin = parseUrl(
    process.env.CAPTURE_TRACKER_FULLPG_ADMIN_URL,
    "CAPTURE_TRACKER_FULLPG_ADMIN_URL",
    fullPostgresDatabases.admin,
  );
  const validation = parseUrl(
    process.env.CAPTURE_TRACKER_FULLPG_VALIDATION_URL,
    "CAPTURE_TRACKER_FULLPG_VALIDATION_URL",
    fullPostgresDatabases.validation,
  );
  const integration = parseUrl(
    process.env.CAPTURE_TRACKER_FULLPG_INTEGRATION_URL,
    "CAPTURE_TRACKER_FULLPG_INTEGRATION_URL",
    fullPostgresDatabases.integration,
  );
  const normal = process.env.DATABASE_URL?.trim();
  const urls = [admin, validation, integration];

  if (new Set(urls.map((url) => url.href)).size !== urls.length)
    throw new Error("Full PostgreSQL URLs must target distinct databases.");
  if (normal && urls.some((url) => url.href === normal))
    throw new Error("Full PostgreSQL targets must not equal DATABASE_URL.");

  return {
    adminUrl: admin.href,
    validationUrl: validation.href,
    integrationUrl: integration.href,
    host: admin.hostname,
    port: Number(admin.port || "5432"),
  };
}

export function requireValidationConfirmation() {
  if (
    process.env.CAPTURE_TRACKER_FULLPG_CONFIRMATION !==
    "CAPTURE_TRACKER_FULLPG_VALIDATION_ONLY"
  ) {
    throw new Error("Full PostgreSQL validation confirmation is required.");
  }
}

export async function queryServerIdentity(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query("SELECT version() AS version");
    const version = String(result.rows[0]?.version ?? "");
    if (!/^PostgreSQL 17\b/.test(version))
      throw new Error(
        "The target is not the discovered local PostgreSQL 17 server.",
      );
    return version.match(/^PostgreSQL [^,]+/)?.[0] ?? "PostgreSQL 17";
  } finally {
    await client.end();
  }
}

export async function withClient(connectionString, operation) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}
