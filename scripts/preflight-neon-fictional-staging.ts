import pg from "pg";
import "./load-local-staging-environment";
import { readCloudEnvironment } from "../src/lib/cloud/environment";

type CountRow = { count: string };
type TlsRow = { status: "enabled" | "disabled" };
type VersionRow = { version: string };
type NameRow = { name: string };

export type NeonFictionalStagingPreflight = {
  result: "PASS";
  serverVersion: string;
  ssl: true;
  databaseClassification: "approved-default-fictional-staging";
  schemaCount: number;
  migrationCount: number;
  applicationTableCount: number;
  dataState: "empty";
  verifiedAtUtc: string;
};

type PreflightFailureStage = "CONNECT" | "SERVER_VERSION" | "TLS" | "DATABASE" | "SCHEMA" | "MIGRATIONS" | "APPLICATION_TABLES" | "VALIDATE";

type SanitizedValidationFacts = {
  serverVersion: string | null;
  tls: boolean;
  databaseTargetMatchesExpected: boolean;
  schemaCount: number;
  unexpectedSchemaCount: number;
  migrationTableCount: number;
  applicationTableCount: number;
};

class PreflightFailure extends Error {
  constructor(readonly stage: PreflightFailureStage) {
    super("Neon preflight failed.");
  }
}

class PreflightValidationFailure extends Error {
  constructor(readonly facts: SanitizedValidationFacts) {
    super("Neon preflight validation failed.");
  }
}

function count(row: CountRow | undefined) {
  return Number(row?.count ?? Number.NaN);
}

function usesTlsTransport(client: pg.Client) {
  const stream = (client as unknown as { connection?: { stream?: { encrypted?: boolean } } }).connection?.stream;
  return stream?.encrypted === true;
}

export async function preflightNeonFictionalStaging(input: Record<string, string | undefined> = process.env): Promise<NeonFictionalStagingPreflight> {
  const config = readCloudEnvironment(input);
  if (
    config.deploymentProfile !== "free-preview-cloudflare-neon" ||
    config.environment !== "staging" ||
    config.executionContext !== "cloudflare" ||
    config.realDataApproved ||
    !config.runtimeDatabaseUrl ||
    !config.expectedDatabaseName
  ) {
    throw new Error("Neon preflight is limited to approved fictional staging.");
  }

  const client = new pg.Client({
    connectionString: config.runtimeDatabaseUrl,
    ssl: { rejectUnauthorized: true },
  });

  let stage: PreflightFailureStage = "CONNECT";
  try {
    await client.connect();
    const transportTls = usesTlsTransport(client);
    stage = "SERVER_VERSION";
    const versionResult = await client.query<VersionRow>("SELECT current_setting('server_version') AS version");
    stage = "TLS";
    const sslResult = await client.query<TlsRow>("SELECT CASE WHEN COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) THEN 'enabled' ELSE 'disabled' END AS status");
    stage = "DATABASE";
    const databaseResult = await client.query<NameRow>("SELECT current_database() AS name");
    stage = "SCHEMA";
    const schemaResult = await client.query<CountRow>("SELECT count(*)::text AS count FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'");
    const unexpectedSchemaResult = await client.query<CountRow>("SELECT count(*)::text AS count FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' AND nspname NOT IN ('public', 'neon')");
    stage = "MIGRATIONS";
    const migrationTableResult = await client.query<CountRow>("SELECT count(*)::text AS count FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations'");
    stage = "APPLICATION_TABLES";
    const applicationTableResult = await client.query<CountRow>("SELECT count(*)::text AS count FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'");

    const serverVersion = versionResult.rows[0]?.version;
    const tlsEnabled = sslResult.rows[0]?.status === "enabled";
    const databaseName = databaseResult.rows[0]?.name;
    const schemaCount = count(schemaResult.rows[0]);
    const unexpectedSchemaCount = count(unexpectedSchemaResult.rows[0]);
    const migrationTableCount = count(migrationTableResult.rows[0]);
    const applicationTableCount = count(applicationTableResult.rows[0]);

    stage = "VALIDATE";
    const facts = {
      serverVersion: serverVersion ?? null,
      tls: tlsEnabled,
      databaseTargetMatchesExpected: databaseName === config.expectedDatabaseName,
      schemaCount,
      unexpectedSchemaCount,
      migrationTableCount,
      applicationTableCount,
    };
    if (!/^18(?:\.\d+)?(?:\s|$)/.test(serverVersion ?? "") || !transportTls || databaseName !== config.expectedDatabaseName || unexpectedSchemaCount !== 0 || migrationTableCount !== 0 || applicationTableCount !== 0) {
      throw new PreflightValidationFailure(facts);
    }

    return {
      result: "PASS",
      serverVersion,
      ssl: true,
      databaseClassification: "approved-default-fictional-staging",
      schemaCount,
      migrationCount: 0,
      applicationTableCount: 0,
      dataState: "empty",
      verifiedAtUtc: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof PreflightValidationFailure) throw error;
    throw new PreflightFailure(stage);
  } finally {
    await client.end();
  }
}

preflightNeonFictionalStaging()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    if (error instanceof PreflightValidationFailure) {
      console.error(JSON.stringify({ result: "FAIL", reason: "NEON_PREFLIGHT_VALIDATION_FAILED", ...error.facts }));
    } else {
      console.error(JSON.stringify({ result: "FAIL", reason: "NEON_PREFLIGHT_FAILED", stage: error instanceof PreflightFailure ? error.stage : "CONFIG" }));
    }
    process.exitCode = 1;
  });
