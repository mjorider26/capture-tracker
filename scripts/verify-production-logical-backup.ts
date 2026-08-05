import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "pg";

import { decryptBackupArchive } from "./production-logical-backup-core";

const restoreDatabase = "capture_tracker_restore_test";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
let restoreStage = "guard";

function restoreTarget(value: string | undefined) {
  if (process.platform !== "linux") throw new Error("NATIVE_LINUX_REQUIRED");
  if (!value) throw new Error("RESTORE_TARGET_REQUIRED");
  const url = new URL(value);
  if (!localHosts.has(url.hostname) || decodeURIComponent(url.pathname.slice(1)) !== restoreDatabase) throw new Error("RESTORE_TARGET_REFUSED");
  return url;
}

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ["ignore", "ignore", "pipe"] });
    child.once("error", () => reject(new Error("RESTORE_COMMAND_FAILED")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("RESTORE_COMMAND_FAILED")));
  });
}

function postgresEnvironment(url: URL) {
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: restoreDatabase };
}

async function dropRestoreDatabase(url: URL) {
  const admin = new URL(url.href);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.href });
  await client.connect();
  try {
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [restoreDatabase]);
    await client.query(`DROP DATABASE IF EXISTS "${restoreDatabase}"`);
  } finally { await client.end(); }
}

async function verifyCatalog(url: URL) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL) AS migrations,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
      (SELECT count(*)::int FROM information_schema.routines WHERE routine_schema='public') AS functions,
      (SELECT count(*)::int FROM information_schema.triggers WHERE trigger_schema='public') AS triggers,
      (SELECT count(*)::int FROM information_schema.table_constraints WHERE constraint_schema='public') AS constraints,
      (SELECT count(*)::int FROM "User") AS users,
      (SELECT count(*)::int FROM "Business") AS businesses,
      (SELECT count(*)::int FROM "Transaction") AS transactions,
      (SELECT count(*)::int FROM "Document") AS documents,
      (SELECT count(*)::int FROM "JournalEntry") AS journal_entries,
      (SELECT count(*)::int FROM "BusinessMember" bm JOIN "Business" b ON b.id=bm."businessId" LEFT JOIN "User" u ON u.id=bm."userId" WHERE b.id IS NULL OR u.id IS NULL) AS orphan_memberships,
      (SELECT coalesce(sum("debitAmount"),0)=coalesce(sum("creditAmount"),0) FROM "JournalLine") AS ledger_balanced`);
    const row = result.rows[0];
    if (!row || row.migrations !== 16 || row.tables < 30 || row.functions !== 14 || row.triggers !== 11 || row.constraints < 30 || row.users !== 0 || row.businesses !== 0 || row.transactions !== 0 || row.documents !== 0 || row.journal_entries !== 0 || row.orphan_memberships !== 0 || row.ledger_balanced !== true) throw new Error("RESTORE_CATALOG_VERIFICATION_FAILED");
    return row;
  } finally { await client.end(); }
}

async function main() {
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_AUTHORIZATION !== "CAPTURE_TRACKER_LOGICAL_RESTORE_VERIFICATION_APPROVED") throw new Error("RESTORE_AUTHORIZATION_REFUSED");
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_CONFIRMATION !== "RESTORE_DISPOSABLE_LOCAL_VERIFICATION_ONLY") throw new Error("RESTORE_CONFIRMATION_REFUSED");
  const source = process.env.CAPTURE_TRACKER_ENCRYPTED_BACKUP_ARCHIVE;
  const passphrase = process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_PASSPHRASE;
  if (!source || !passphrase || source.startsWith("/mnt/")) throw new Error("RESTORE_SOURCE_REFUSED");
  const target = restoreTarget(process.env.CAPTURE_TRACKER_RESTORE_TEST_DATABASE_URL);
  const temporaryArchive = join("/dev/shm", `capture-tracker-restore-${Date.now()}.dump`);
  try {
    restoreStage = "decrypt";
    writeFileSync(temporaryArchive, decryptBackupArchive(readFileSync(source), passphrase), { mode: 0o600, flag: "wx" });
    restoreStage = "drop-prior";
    await dropRestoreDatabase(target);
    restoreStage = "create";
    const admin = new URL(target.href); admin.pathname = "/postgres";
    const adminClient = new Client({ connectionString: admin.href });
    await adminClient.connect();
    try { await adminClient.query(`CREATE DATABASE "${restoreDatabase}" TEMPLATE template0`); } finally { await adminClient.end(); }
    restoreStage = "pg-restore";
    await run("pg_restore", ["--no-owner", "--no-privileges", "--dbname", target.href, temporaryArchive], postgresEnvironment(target));
    restoreStage = "catalog";
    const catalog = await verifyCatalog(target);
    console.log(`LOGICAL RESTORE VERIFIED: migrations=${catalog.migrations} tables=${catalog.tables} functions=${catalog.functions} triggers=${catalog.triggers} constraints=${catalog.constraints} users=${catalog.users} businesses=${catalog.businesses} transactions=${catalog.transactions} documents=${catalog.documents} journal_entries=${catalog.journal_entries}`);
  } finally {
    rmSync(temporaryArchive, { force: true });
    await dropRestoreDatabase(target).catch(() => undefined);
  }
}

main().catch(() => { console.error(`LOGICAL RESTORE VERIFICATION FAILED AT ${restoreStage}; production was not touched.`); process.exitCode = 1; });
