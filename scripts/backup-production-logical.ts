import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

import { assertDirectProductionUrl, productionAcceptance } from "./production-acceptance-cleanup-core";
import { assertBackupPrefix, encryptBackupArchive } from "./production-logical-backup-core";

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

async function sourceMetadata(url: URL) {
  const client = new Client({ connectionString: url.href });
  await client.connect();
  try {
    const [version, migrations] = await Promise.all([
      client.query("SHOW server_version"),
      client.query('SELECT count(*)::text AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL'),
    ]);
    return { postgresVersion: String(version.rows[0]?.server_version ?? "unknown"), migrationCount: Number(migrations.rows[0]?.count ?? "0") };
  } finally { await client.end(); }
}

async function uploadAndVerify(objectKey: string, source: string, expectedChecksum: string) {
  const downloaded = join("/dev/shm/capture-tracker-production-backup", `verify-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    await run("npx", ["wrangler", "r2", "object", "put", `${productionAcceptance.backupBucket}/${objectKey}`, "--file", source, "--remote"], process.env);
    await run("npx", ["wrangler", "r2", "object", "get", `${productionAcceptance.backupBucket}/${objectKey}`, "--file", downloaded, "--remote"], process.env);
    if (createHash("sha256").update(readFileSync(downloaded)).digest("hex") !== expectedChecksum) throw new Error("BACKUP_UPLOAD_CHECKSUM_FAILED");
  } finally { rmSync(downloaded, { force: true }); }
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
      timestamp: new Date().toISOString(), database: productionAcceptance.database, sourceCommit,
      postgresVersion: metadata.postgresVersion, archiveSizeBytes: statSync(temporaryEncryptedArchive).size,
      sha256: checksum, migrationCount: metadata.migrationCount, encryption: "AES-256-GCM+scrypt",
      archive: archiveName,
    };
    writeFileSync(temporaryManifest, `${JSON.stringify(manifest)}\n`, { mode: 0o600, flag: "wx" });
    await uploadAndVerify(`${prefix}${archiveName}`, temporaryEncryptedArchive, checksum);
    const manifestChecksum = createHash("sha256").update(readFileSync(temporaryManifest)).digest("hex");
    await uploadAndVerify(`${prefix}${archiveName}.json`, temporaryManifest, manifestChecksum);
    console.log(`LOGICAL BACKUP CREATED: database=${manifest.database} bytes=${manifest.archiveSizeBytes} migrations=${manifest.migrationCount} sha256=${checksum.slice(0, 16)}`);
  } finally {
    rmSync(temporaryArchive, { force: true });
    rmSync(temporaryEncryptedArchive, { force: true });
    rmSync(temporaryManifest, { force: true });
  }
}

main().catch(() => { console.error("LOGICAL BACKUP REFUSED OR FAILED; no archive metadata or credential was printed."); process.exitCode = 1; });
