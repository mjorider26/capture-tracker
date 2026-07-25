import pg from "pg";
import { readCloudEnvironment } from "../src/lib/cloud/environment";

export async function verifyFutureNeonFictionalStaging(input: Record<string, string | undefined> = process.env) {
  const config = readCloudEnvironment(input);
  if (config.deploymentProfile !== "free-preview-cloudflare-neon" || config.environment !== "staging" || config.realDataApproved || !config.runtimeDatabaseUrl) throw new Error("Neon verification is limited to fictional staging.");
  const client = new pg.Client({ connectionString: config.runtimeDatabaseUrl, ssl: { rejectUnauthorized: true } });
  await client.connect();
  try {
    const [identity, tls, database] = await Promise.all([
      client.query("SELECT version() AS version"),
      client.query("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()"),
      client.query("SELECT current_database() AS name"),
    ]);
    if (!/^PostgreSQL /i.test(String(identity.rows[0]?.version ?? "")) || tls.rows[0]?.ssl !== true || database.rows[0]?.name !== config.expectedDatabaseName) throw new Error("Neon fictional staging verification failed.");
  } finally { await client.end(); }
}
