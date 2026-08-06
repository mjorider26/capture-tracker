import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "pg";

import { decryptBackupArchive } from "./production-logical-backup-core";
import {
  assertRestoreTarget,
  assertRestoredBackupState,
  assertLogicalBackupReceipt,
  deriveSourceSchemaInventory,
  withTemporaryRecoveryArtifacts,
  type LogicalBackupManifest,
  type SanitizedDataCounts,
} from "./production-logical-restore-core";
import { getBackupObject } from "./r2-scoped-object-storage";

let restoreStage = "guard";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ["ignore", "ignore", "pipe"] });
    child.once("error", () => reject(new Error("RESTORE_COMMAND_FAILED")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("RESTORE_COMMAND_FAILED")));
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

async function verifyCatalog(url: URL, manifest: LogicalBackupManifest) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const expected = deriveSourceSchemaInventory();
    const migrations = await client.query('SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt", logs FROM "_prisma_migrations" ORDER BY migration_name');
    const tables = await client.query<{ name: string }>("SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
    const functions = await client.query<{ name: string }>("SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema='public'");
    const triggers = await client.query<{ name: string }>("SELECT DISTINCT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema='public'");
    const constraints = await client.query<{ name: string }>("SELECT constraint_name AS name FROM information_schema.table_constraints WHERE constraint_schema='public'");
    const counts = await client.query<SanitizedDataCounts>('SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Business") AS businesses, (SELECT count(*)::int FROM "Transaction") AS transactions, (SELECT count(*)::int FROM "Document") AS documents, (SELECT count(*)::int FROM "JournalEntry") AS "journalEntries", (SELECT count(*)::int FROM "JournalLine") AS "journalLines"');
    const integrity = await client.query('SELECT (SELECT count(*)::int FROM "BusinessMember" bm JOIN "Business" b ON b.id=bm."businessId" LEFT JOIN "User" u ON u.id=bm."userId" WHERE b.id IS NULL OR u.id IS NULL) AS orphan_memberships, (SELECT coalesce(sum("debitAmount"),0)=coalesce(sum("creditAmount"),0) FROM "JournalLine") AS ledger_balanced');
    const actual = (rows: Array<{ name: string }>) => new Set(rows.map((row) => row.name));
    const missing = (required: string[], received: Set<string>) => required.filter((name) => !received.has(name));
    const missingStructure = [
      ...missing(expected.tables, actual(tables.rows)),
      ...missing(expected.functions, actual(functions.rows)),
      ...missing(expected.triggers, actual(triggers.rows)),
      ...missing(expected.constraints, actual(constraints.rows)),
    ];
    const dataCounts = counts.rows[0];
    const integrityRow = integrity.rows[0];
    if (!dataCounts || missingStructure.length || integrityRow?.orphan_memberships !== 0 || integrityRow?.ledger_balanced !== true) throw new Error("RESTORE_CATALOG_VERIFICATION_FAILED");
    assertRestoredBackupState({ expected, manifest, records: migrations.rows, counts: dataCounts });
    return { migrations: expected.names.length, tables: expected.tables.length, functions: expected.functions.length, triggers: expected.triggers.length, constraints: expected.constraints.length, dataCounts };
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
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_AUTHORIZATION !== "CAPTURE_TRACKER_LOGICAL_RESTORE_VERIFICATION_APPROVED") throw new Error("RESTORE_AUTHORIZATION_REFUSED");
  if (process.env.CAPTURE_TRACKER_RESTORE_VERIFICATION_CONFIRMATION !== "RESTORE_DISPOSABLE_LOCAL_VERIFICATION_ONLY") throw new Error("RESTORE_CONFIRMATION_REFUSED");
  const passphrase = process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error("RESTORE_SOURCE_REFUSED");
  const target = assertRestoreTarget(process.env.CAPTURE_TRACKER_RESTORE_TEST_DATABASE_URL);
  const temporaryArchive = join("/dev/shm", `capture-tracker-restore-${Date.now()}.dump`);
  try {
    const sources = await recoverySources();
    await withTemporaryRecoveryArtifacts([temporaryArchive, ...sources.cleanup], async () => {
      const manifest = JSON.parse(readFileSync(sources.manifest, "utf8")) as LogicalBackupManifest;
      const encrypted = readFileSync(sources.archive);
      if (createHash("sha256").update(encrypted).digest("hex") !== manifest.sha256) throw new Error("RESTORE_CHECKSUM_REFUSED");
      restoreStage = "decrypt";
      writeFileSync(temporaryArchive, decryptBackupArchive(encrypted, passphrase), { mode: 0o600, flag: "wx" });
      restoreStage = "drop-prior";
      await dropRestoreDatabase(target);
      restoreStage = "create";
      const admin = new URL(target.href); admin.pathname = "/postgres";
      const adminClient = new Client({ connectionString: admin.href });
      await adminClient.connect();
      try { await adminClient.query(`CREATE DATABASE "${decodeURIComponent(target.pathname.slice(1))}" TEMPLATE template0`); } finally { await adminClient.end(); }
      restoreStage = "pg-restore";
      await run("pg_restore", ["--no-owner", "--no-privileges", "--dbname", target.href, temporaryArchive], postgresEnvironment(target));
      restoreStage = "catalog";
      const catalog = await verifyCatalog(target, manifest);
      console.log(`LOGICAL RESTORE VERIFIED: migrations=${catalog.migrations} tables=${catalog.tables} functions=${catalog.functions} triggers=${catalog.triggers} constraints=${catalog.constraints} dataCountsMatch=true`);
    });
  } finally {
    await dropRestoreDatabase(target).catch(() => undefined);
  }
}

main().catch(() => { console.error(`LOGICAL RESTORE VERIFICATION FAILED AT ${restoreStage}; production was not touched.`); process.exitCode = 1; });
