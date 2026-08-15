import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

import { assertDirectProductionUrl, productionAcceptance } from "./production-acceptance-cleanup-core";
import {
  cleanupTemporaryPaths,
  operationalCommandError,
  sanitizedFailureLine,
  type BackupStage,
} from "./production-backup-observability-core";
import { assertBackupPrefix, decryptBackupArchive, encryptBackupArchive } from "./production-logical-backup-core";
import {
  assertBackupMigrationState,
  assertLogicalBackupManifest,
  assertProductionBackupMode,
  deriveSourceMigrationInventory,
  type ProductionBackupMode,
  type SanitizedDataCounts,
} from "./production-logical-restore-core";
import { getBackupObject, putBackupObject } from "./r2-scoped-object-storage";

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", () => reject(operationalCommandError("BACKUP_COMMAND_FAILED", 1, "dependency unavailable")));
    child.once("exit", (code) => code === 0 ? resolvePromise(output) : reject(operationalCommandError("BACKUP_COMMAND_FAILED", code, output)));
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

async function sourceMetadata(url: URL, backupMode: ProductionBackupMode, authorizedReleaseCommit: string) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const version = await client.query("SHOW server_version");
    const migrations = await client.query('SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt", logs FROM "_prisma_migrations" ORDER BY migration_name');
    const counts = await client.query<SanitizedDataCounts>('SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Business") AS businesses, (SELECT count(*)::int FROM "Transaction") AS transactions, (SELECT count(*)::int FROM "Document") AS documents, (SELECT count(*)::int FROM "JournalEntry") AS "journalEntries", (SELECT count(*)::int FROM "JournalLine") AS "journalLines"');
    const sourceMigrationInventory = deriveSourceMigrationInventory();
    const migrationState = assertBackupMigrationState({
      mode: backupMode,
      source: sourceMigrationInventory,
      records: migrations.rows,
      authorizedReleaseCommit,
    });
    const dataCounts = counts.rows[0];
    if (!dataCounts) throw new Error("BACKUP_DATA_COUNTS_REFUSED");
    return {
      postgresVersion: String(version.rows[0]?.server_version ?? "unknown"),
      sourceMigrationInventory,
      productionMigrationInventory: migrationState.productionMigrationInventory,
      pendingMigrationNames: migrationState.pendingMigrationNames,
      databaseMigrationStateDigest: migrationState.databaseMigrationStateDigest,
      dataCounts,
    };
  } finally { await client.end(); }
}

async function main() {
  let stage: BackupStage = "BACKUP_PREFLIGHT";
  let component = "authorization";
  let failure: { stage: BackupStage; component: string; error: unknown } | undefined;
  let successSummary: string | undefined;
  let temporaryPaths: string[] = [];

  const start = (nextStage: BackupStage, nextComponent: string) => {
    stage = nextStage;
    component = nextComponent;
    console.log(`BACKUP_STAGE stage=${stage} status=START component=${component}`);
  };
  const pass = (details = "") => console.log(`BACKUP_STAGE stage=${stage} status=PASS component=${component}${details ? ` ${details}` : ""}`);

  try {
    start("BACKUP_PREFLIGHT", "authorization");
    if (process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_AUTHORIZATION !== "CAPTURE_TRACKER_LOGICAL_BACKUP_APPROVED") throw new Error("BACKUP_AUTHORIZATION_REFUSED");
    component = "backup_scope";
    const prefix = assertBackupPrefix(process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_TYPE);
    const backupMode = assertProductionBackupMode(process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_MODE);
    if (backupMode === "PRE_MIGRATION_RELEASE" && process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_TYPE !== "pre-acceptance") throw new Error("PRE_MIGRATION_PREFIX_REFUSED");
    component = "backup_passphrase";
    const passphrase = process.env.CAPTURE_TRACKER_PRODUCTION_BACKUP_PASSPHRASE;
    if (!passphrase) throw new Error("BACKUP_PASSPHRASE_REQUIRED");
    component = "production_database";
    const direct = assertDirectProductionUrl(process.env.CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL);
    component = "temporary_storage";
    const temporaryRoot = "/dev/shm/capture-tracker-production-backup";
    mkdirSync(temporaryRoot, { recursive: true, mode: 0o700 });
    chmodSync(temporaryRoot, 0o700);
    const stamp = new Date().toISOString().replace(/[-:.]/g, "");
    const temporaryArchive = join(temporaryRoot, `capture-tracker-production-${stamp}.dump`);
    const temporaryEncryptedArchive = join(temporaryRoot, `capture-tracker-production-${stamp}.ctbackup`);
    const temporaryManifest = join(temporaryRoot, `capture-tracker-production-${stamp}.json`);
    temporaryPaths = [temporaryArchive, temporaryEncryptedArchive, temporaryManifest];
    component = "source_commit";
    const authorizedReleaseCommit = (await run("git", ["rev-parse", "HEAD"], process.env)).trim();
    const sourceStatus = await run("git", ["status", "--porcelain"], process.env);
    if (!/^[a-f0-9]{40}$/i.test(authorizedReleaseCommit) || sourceStatus.trim()) throw new Error("BACKUP_SOURCE_COMMIT_REFUSED");
    component = "migration_inventory";
    const metadata = await sourceMetadata(direct, backupMode, authorizedReleaseCommit);
    pass(`source=${authorizedReleaseCommit} productionMigrations=${metadata.productionMigrationInventory.names.length} pendingMigrations=${metadata.pendingMigrationNames.length}`);

    start("DATABASE_DUMP", "pg_dump");
    await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", temporaryArchive], postgresEnvironment(direct));
    chmodSync(temporaryArchive, 0o600);
    const plain = readFileSync(temporaryArchive);
    if (!plain.length) throw new Error("BACKUP_DUMP_VALIDATION_FAILED");
    pass(`bytes=${plain.length}`);

    start("DUMP_VALIDATION", "pg_restore_list");
    const archiveListing = await run("pg_restore", ["--list", temporaryArchive], postgresEnvironment(direct));
    if (!archiveListing.includes("TABLE")) throw new Error("BACKUP_DUMP_VALIDATION_FAILED");
    pass("format=custom readable=true");

    start("ENCRYPTION", "aes_256_gcm_scrypt");
    const encrypted = encryptBackupArchive(plain, passphrase);
    if (encrypted.equals(plain)) throw new Error("BACKUP_ENCRYPTION_VALIDATION_FAILED");
    writeFileSync(temporaryEncryptedArchive, encrypted, { mode: 0o600, flag: "wx" });
    pass(`bytes=${encrypted.length}`);

    start("ENCRYPTED_ARTIFACT_VALIDATION", "decrypt_round_trip");
    if (!decryptBackupArchive(encrypted, passphrase).equals(plain)) throw new Error("BACKUP_ENCRYPTION_VALIDATION_FAILED");
    plain.fill(0);
    pass("decryptable=true plaintextDifferent=true");

    start("CHECKSUM", "sha256");
    const checksum = createHash("sha256").update(encrypted).digest("hex");
    if (createHash("sha256").update(readFileSync(temporaryEncryptedArchive)).digest("hex") !== checksum) throw new Error("BACKUP_CHECKSUM_FAILED");
    pass(`sha256=${checksum}`);

    start("MANIFEST", "manifest_v3");
    const archiveName = `capture-tracker-production-${stamp}-${authorizedReleaseCommit.slice(0, 12)}.ctbackup`;
    const manifest = {
      schemaVersion: 3 as const,
      timestamp: new Date().toISOString(),
      database: productionAcceptance.database,
      backupMode,
      authorizedReleaseCommit,
      postgresVersion: metadata.postgresVersion,
      archiveSizeBytes: statSync(temporaryEncryptedArchive).size,
      sha256: checksum,
      encryption: "AES-256-GCM+scrypt" as const,
      sourceMigrationInventory: { names: metadata.sourceMigrationInventory.names, digest: metadata.sourceMigrationInventory.digest },
      productionMigrationInventory: metadata.productionMigrationInventory,
      pendingMigrationNames: metadata.pendingMigrationNames,
      databaseMigrationStateDigest: metadata.databaseMigrationStateDigest,
      dataCounts: metadata.dataCounts,
      archive: archiveName,
    };
    assertLogicalBackupManifest(manifest, metadata.sourceMigrationInventory);
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest)}\n`, { mode: 0o600, flag: "wx" });
    const manifestChecksum = createHash("sha256").update(readFileSync(temporaryManifest)).digest("hex");
    pass(`schemaVersion=3 backupMode=${backupMode}`);

    const archiveKey = `${prefix}${archiveName}`;
    const manifestKey = `${archiveKey}.json`;
    start("R2_UPLOAD", "encrypted_archive");
    await putBackupObject(archiveKey, readFileSync(temporaryEncryptedArchive));
    pass("object=encrypted_archive");

    start("REMOTE_CHECKSUM_VERIFY", "encrypted_archive");
    if (createHash("sha256").update(await getBackupObject(archiveKey)).digest("hex") !== checksum) throw new Error("BACKUP_UPLOAD_CHECKSUM_FAILED");
    pass(`object=encrypted_archive sha256=${checksum}`);

    start("R2_UPLOAD", "manifest");
    await putBackupObject(manifestKey, readFileSync(temporaryManifest));
    pass("object=manifest");

    start("REMOTE_CHECKSUM_VERIFY", "manifest");
    if (createHash("sha256").update(await getBackupObject(manifestKey)).digest("hex") !== manifestChecksum) throw new Error("BACKUP_UPLOAD_CHECKSUM_FAILED");
    pass(`object=manifest sha256=${manifestChecksum}`);

    start("R2_RECEIPT", "verified_object_pair");
    writeRecoveryDrillReceipt(process.env.CAPTURE_TRACKER_LOGICAL_BACKUP_RECEIPT, { archiveKey, manifestKey });
    pass("remoteVerified=true");
    successSummary = `LOGICAL BACKUP CREATED: database=${manifest.database} mode=${manifest.backupMode} bytes=${manifest.archiveSizeBytes} productionMigrations=${manifest.productionMigrationInventory.names.length} pendingMigrations=${manifest.pendingMigrationNames.length} sha256=${checksum}`;
  } catch (error) {
    failure = { stage, component, error };
  }

  const cleanup = cleanupTemporaryPaths(temporaryPaths);
  console.log(`BACKUP_STAGE stage=CLEANUP status=${cleanup.status} component=temporary_artifacts retained=${cleanup.retainedCount}`);
  if (failure) {
    console.error(sanitizedFailureLine({ operation: "BACKUP", ...failure, cleanup: cleanup.status }));
    process.exitCode = 1;
    return;
  }
  if (cleanup.status === "FAIL") {
    console.error(sanitizedFailureLine({ operation: "BACKUP", stage: "CLEANUP", component: "temporary_artifacts", error: new Error("BACKUP_CLEANUP_FAILED"), cleanup: cleanup.status }));
    process.exitCode = 1;
    return;
  }
  console.log(successSummary);
}

main().catch((error) => {
  console.error(sanitizedFailureLine({ operation: "BACKUP", stage: "BACKUP_PREFLIGHT", component: "unexpected", error, cleanup: "FAIL" }));
  process.exitCode = 1;
});
