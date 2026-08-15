import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "pg";

import {
  operationalCommandError,
  sanitizedFailureLine,
  type BackupStage,
} from "./production-backup-observability-core";
import { decryptBackupArchive } from "./production-logical-backup-core";
import {
  assertLogicalBackupManifest,
  assertRestoreTarget,
  assertRestoredBackupState,
  assertLogicalBackupReceipt,
  deriveSourceSchemaInventory,
  isExactSourceBackup,
  withTemporaryRecoveryArtifacts,
  type AnyLogicalBackupManifest,
  type SanitizedDataCounts,
} from "./production-logical-restore-core";
import { getBackupObject } from "./r2-scoped-object-storage";

let restoreStage: BackupStage = "RESTORE_PREP";
let restoreComponent = "authorization";
let restoreCleanup: "PASS" | "FAIL" = "PASS";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ["ignore", "ignore", "pipe"] });
    let output = "";
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", () => reject(operationalCommandError("RESTORE_COMMAND_FAILED", 1, "dependency unavailable")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(operationalCommandError("RESTORE_COMMAND_FAILED", code, output)));
  });
}

function postgresEnvironment(url: URL) {
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)) };
}

async function dropRestoreDatabase(url: URL) {
  const admin = new URL(url.href);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.href });
  await client.connect();
  try {
    const database = decodeURIComponent(url.pathname.slice(1));
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [database]);
    await client.query(`DROP DATABASE IF EXISTS "${database}"`);
  } finally { await client.end(); }
}

async function verifyCatalog(url: URL, manifest: AnyLogicalBackupManifest) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const expected = deriveSourceSchemaInventory();
    const migrations = await client.query('SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt", logs FROM "_prisma_migrations" ORDER BY migration_name');
    const exactSourceBackup = isExactSourceBackup(manifest);
    const tables = exactSourceBackup ? await client.query<{ name: string }>("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'") : undefined;
    const functions = exactSourceBackup ? await client.query<{ name: string }>("SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema='public'") : undefined;
    const triggers = exactSourceBackup ? await client.query<{ name: string }>("SELECT DISTINCT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema='public'") : undefined;
    const constraints = exactSourceBackup ? await client.query<{ name: string }>("SELECT constraint_name AS name FROM information_schema.table_constraints WHERE constraint_schema='public'") : undefined;
    const counts = await client.query<SanitizedDataCounts>('SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Business") AS businesses, (SELECT count(*)::int FROM "Transaction") AS transactions, (SELECT count(*)::int FROM "Document") AS documents, (SELECT count(*)::int FROM "JournalEntry") AS "journalEntries", (SELECT count(*)::int FROM "JournalLine") AS "journalLines"');
    const integrity = await client.query('SELECT (SELECT count(*)::int FROM "BusinessMember" bm JOIN "Business" b ON b.id=bm."businessId" LEFT JOIN "User" u ON u.id=bm."userId" WHERE b.id IS NULL OR u.id IS NULL) AS orphan_memberships, (SELECT coalesce(sum("debitAmount"),0)=coalesce(sum("creditAmount"),0) FROM "JournalLine") AS ledger_balanced');
    const actual = (rows: Array<{ name: string }>) => new Set(rows.map((row) => row.name));
    const missing = (required: string[], received: Set<string>) => required.filter((name) => !received.has(name));
    const missingStructure = exactSourceBackup ? [
      ...missing(expected.tables, actual(tables!.rows)),
      ...missing(expected.functions, actual(functions!.rows)),
      ...missing(expected.triggers, actual(triggers!.rows)),
      ...missing(expected.constraints, actual(constraints!.rows)),
    ] : [];
    const dataCounts = counts.rows[0];
    const integrityRow = integrity.rows[0];
    if (!dataCounts || missingStructure.length || integrityRow?.orphan_memberships !== 0 || integrityRow?.ledger_balanced !== true) throw new Error("RESTORE_CATALOG_VERIFICATION_FAILED");
    assertRestoredBackupState({ expected, manifest, records: migrations.rows, counts: dataCounts });
    const restoredMigrations = manifest.schemaVersion === 3 ? manifest.productionMigrationInventory.names.length : expected.names.length;
    return { migrations: restoredMigrations, tables: exactSourceBackup ? expected.tables.length : 0, functions: exactSourceBackup ? expected.functions.length : 0, triggers: exactSourceBackup ? expected.triggers.length : 0, constraints: exactSourceBackup ? expected.constraints.length : 0, dataCounts };
  } finally { await client.end(); }
}

async function recoverySources() {
  const receiptPath = process.env.CAPTURE_TRACKER_LOGICAL_BACKUP_RECEIPT;
  if (!receiptPath) {
    const archive = process.env.CAPTURE_TRACKER_ENCRYPTED_BACKUP_ARCHIVE;
    const manifest = process.env.CAPTURE_TRACKER_LOGICAL_BACKUP_MANIFEST;
    if (!archive || !manifest || archive.startsWith("/mnt/") || manifest.startsWith("/mnt/")) throw new Error("RESTORE_SOURCE_REFUSED");
    return { archive, manifest, cleanup: [] as string[] };
  }
  if (!receiptPath.startsWith("/dev/shm/") || receiptPath.startsWith("/mnt/")) throw new Error("RESTORE_SOURCE_REFUSED");
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  assertLogicalBackupReceipt(receipt);
  const root = "/dev/shm/capture-tracker-production-restore";
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const archive = join(root, `${stamp}.ctbackup`);
  const manifest = join(root, `${stamp}.json`);
  try {
    writeFileSync(archive, await getBackupObject(receipt.archiveKey), { mode: 0o600, flag: "wx" });
    writeFileSync(manifest, await getBackupObject(receipt.manifestKey), { mode: 0o600, flag: "wx" });
  } catch (error) {
    rmSync(archive, { force: true });
    rmSync(manifest, { force: true });
    throw error;
  }
  return { archive, manifest, cleanup: [archive, manifest] };
}

async function main() {
  const start = (stage: BackupStage, component: string) => {
    restoreStage = stage;
    restoreComponent = component;
    console.log(`RESTORE_STAGE stage=${stage} status=START component=${component}`);
  };
  const pass = (details = "") => console.log(`RESTORE_STAGE stage=${restoreStage} status=PASS component=${restoreComponent}${details ? ` ${details}` : ""}`);

  start("RESTORE_PREP", "authorization");
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_AUTHORIZATION !== "CAPTURE_TRACKER_LOGICAL_RESTORE_VERIFICATION_APPROVED") throw new Error("RESTORE_AUTHORIZATION_REFUSED");
  restoreComponent = "confirmation";
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_CONFIRMATION !== "RESTORE_DISPOSABLE_LOCAL_VERIFICATION_ONLY") throw new Error("RESTORE_CONFIRMATION_REFUSED");
  restoreComponent = "backup_passphrase";
  const passphrase = process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error("RESTORE_SOURCE_REFUSED");
  restoreComponent = "isolated_target";
  const target = assertRestoreTarget(process.env.CAPTURE_TRACKER_RESTORE_TEST_DATABASE_URL);
  const temporaryArchive = join("/dev/shm", `capture-tracker-restore-${Date.now()}.dump`);
  let operationFailed = false;
  try {
    start("RESTORE_PREP", "verified_object_pair");
    const sources = await recoverySources();
    await withTemporaryRecoveryArtifacts([temporaryArchive, ...sources.cleanup], async () => {
      const manifest = JSON.parse(readFileSync(sources.manifest, "utf8")) as AnyLogicalBackupManifest;
      const expected = deriveSourceSchemaInventory();
      assertLogicalBackupManifest(manifest, expected);
      const encrypted = readFileSync(sources.archive);
      start("REMOTE_CHECKSUM_VERIFY", "encrypted_archive");
      if (createHash("sha256").update(encrypted).digest("hex") !== manifest.sha256) throw new Error("RESTORE_CHECKSUM_REFUSED");
      pass(`sha256=${manifest.sha256}`);
      start("ENCRYPTED_ARTIFACT_VALIDATION", "decrypt");
      writeFileSync(temporaryArchive, decryptBackupArchive(encrypted, passphrase), { mode: 0o600, flag: "wx" });
      pass("decryptable=true");
      start("ISOLATED_RESTORE", "drop_prior_disposable");
      await dropRestoreDatabase(target);
      restoreComponent = "create_disposable";
      const admin = new URL(target.href); admin.pathname = "/postgres";
      const adminClient = new Client({ connectionString: admin.href });
      await adminClient.connect();
      try { await adminClient.query(`CREATE DATABASE "${decodeURIComponent(target.pathname.slice(1))}" TEMPLATE template0`); } finally { await adminClient.end(); }
      restoreComponent = "pg_restore";
      await run("pg_restore", ["--no-owner", "--no-privileges", "--dbname", target.href, temporaryArchive], postgresEnvironment(target));
      pass("database=disposable_local");
      start("RECOVERABILITY_METADATA", "catalog_integrity");
      const catalog = await verifyCatalog(target, manifest);
      pass(`migrations=${catalog.migrations} tables=${catalog.tables} functions=${catalog.functions} triggers=${catalog.triggers} constraints=${catalog.constraints} dataCountsMatch=true`);
      console.log(`LOGICAL RESTORE VERIFIED: migrations=${catalog.migrations} tables=${catalog.tables} functions=${catalog.functions} triggers=${catalog.triggers} constraints=${catalog.constraints} dataCountsMatch=true`);
    });
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      await dropRestoreDatabase(target);
    } catch {
      restoreCleanup = "FAIL";
      if (!operationFailed) {
        restoreStage = "CLEANUP";
        restoreComponent = "drop_disposable";
        throw new Error("RESTORE_CLEANUP_FAILED");
      }
    }
    console.log(`RESTORE_STAGE stage=CLEANUP status=${restoreCleanup} component=temporary_artifacts_and_disposable_database`);
  }
}

main().catch((error) => {
  console.error(`${sanitizedFailureLine({ operation: "RESTORE", stage: restoreStage, component: restoreComponent, error, cleanup: restoreCleanup })} productionTouched=NO`);
  process.exitCode = 1;
});
