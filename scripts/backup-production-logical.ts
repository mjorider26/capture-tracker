import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

import { assertDirectProductionUrl, productionAcceptance } from "./production-acceptance-cleanup-core";
import { assertBackupPrefix, encryptBackupArchive } from "./production-logical-backup-core";
import {
  assertCompletedMigrationState,
  deriveSourceSchemaInventory,
  type SanitizedDataCounts,
} from "./production-logical-restore-core";
import { getBackupObject, putBackupObject } from "./r2-scoped-object-storage";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", () => reject(new Error("BACKUP_COMMAND_FAILED")));
    child.once("exit", (code) => code === 0 ? resolvePromise(output) : reject(new Error("BACKUP_COMMAND_FAILED")));
  });
}

function postgresEnvironment(url: URL) {
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: "require",
  };
}

function writeRecoveryDrillReceipt(receiptPath: string | undefined, receipt: { archiveKey: string; manifestKey: string }) {
  if (!receiptPath) return;
  if (!receiptPath.startsWith("/dev/shm/") || receiptPath.startsWith("/mnt/")) throw new Error("BACKUP_RECEIPT_PATH_REFUSED");
  writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`, { mode: 0o600, flag: "wx" });
}

async function sourceMetadata(url: URL) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const version = await client.query("SHOW server_version");
    const migrations = await client.query('SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt", logs FROM "_prisma_migrations" ORDER BY migration_name');
    const counts = await client.query<SanitizedDataCounts>('SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Business") AS businesses, (SELECT count(*)::int FROM "Transaction") AS transactions, (SELECT count(*)::int FROM "Document") AS documents, (SELECT count(*)::int FROM "JournalEntry") AS "journalEntries", (SELECT count(*)::int FROM "JournalLine") AS "journalLines"');
    const inventory = deriveSourceSchemaInventory();
    const databaseMigrationStateDigest = assertCompletedMigrationState(inventory, migrations.rows);
    const dataCounts = counts.rows[0];
    if (!dataCounts) throw new Error("BACKUP_DATA_COUNTS_REFUSED");
    return {
      postgresVersion: String(version.rows[0]?.server_version ?? "unknown"),
      migrationInventory: { names: inventory.names, digest: inventory.digest },
      databaseMigrationStateDigest,
      dataCounts,
    };
  } finally { await client.end(); }
}

async function uploadAndVerify(objectKey: string, source: string, expectedChecksum: string) {
  await putBackupObject(objectKey, readFileSync(source));
  if (createHash("sha256").update(await getBackupObject(objectKey)).digest("hex") !== expectedChecksum) throw new Error("BACKUP_UPLOAD_CHECKSUM_FAILED");
}

async function main() {
  if (process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_AUTHORIZATION !== "CAPTURE_TRACKER_LOGICAL_BACKUP_APPROVED") throw new Error("BACKUP_AUTHORIZATION_REFUSED");
  const prefix = assertBackupPrefix(process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_TYPE);
  const passphrase = process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error("BACKUP_PASSPHRASE_REQUIRED");
  const direct = assertDirectProductionUrl(process.env.CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL);
  const temporaryRoot = "/dev/shm/capture-tracker-production-backup";
  mkdirSync(temporaryRoot, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  const temporaryArchive = join(temporaryRoot, `capture-tracker-production-${stamp}.dump`);
  const temporaryEncryptedArchive = join(temporaryRoot, `capture-tracker-production-${stamp}.ctbackup`);
  const temporaryManifest = join(temporaryRoot, `capture-tracker-production-${stamp}.json`);
  try {
    const metadata = await sourceMetadata(direct);
    await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", temporaryArchive], postgresEnvironment(direct));
    const plain = readFileSync(temporaryArchive);
    const encrypted = encryptBackupArchive(plain, passphrase);
    writeFileSync(temporaryEncryptedArchive, encrypted, { mode: 0o600, flag: "wx" });
    const checksum = createHash("sha256").update(encrypted).digest("hex");
    const sourceCommit = (await run("git", ["rev-parse", "HEAD"], process.env)).trim();
    const archiveName = `capture-tracker-production-${stamp}-${sourceCommit.slice(0, 12)}.ctbackup`;
    const manifest = {
      schemaVersion: 2 as const,
      timestamp: new Date().toISOString(), database: productionAcceptance.database, sourceCommit,
      postgresVersion: metadata.postgresVersion, archiveSizeBytes: statSync(temporaryEncryptedArchive).size,
      sha256: checksum, encryption: "AES-256-GCM+scrypt" as const,
      migrationInventory: metadata.migrationInventory,
      databaseMigrationStateDigest: metadata.databaseMigrationStateDigest,
      dataCounts: metadata.dataCounts,
      archive: archiveName,
    };
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest)}\n`, { mode: 0o600, flag: "wx" });
    await uploadAndVerify(`${prefix}${archiveName}`, temporaryEncryptedArchive, checksum);
    const manifestChecksum = createHash("sha256").update(readFileSync(temporaryManifest)).digest("hex");
    await uploadAndVerify(`${prefix}${archiveName}.json`, temporaryManifest, manifestChecksum);
    writeRecoveryDrillReceipt(process.env.CAPTURE_TRACKER_LOGICAL_BACKUP_RECEIPT, {
      archiveKey: `${prefix}${archiveName}`,
      manifestKey: `${prefix}${archiveName}.json`,
    });
    console.log(`LOGICAL BACKUP CREATED: database=${manifest.database} bytes=${manifest.archiveSizeBytes} migrations=${manifest.migrationInventory.names.length} sha256=${checksum.slice(0, 16)}`);
  } finally {
    rmSync(temporaryArchive, { force: true });
    rmSync(temporaryEncryptedArchive, { force: true });
    rmSync(temporaryManifest, { force: true });
  }
}

main().catch(() => { console.error("LOGICAL BACKUP REFUSED OR FAILED; no archive metadata or credential was printed."); process.exitCode = 1; });
