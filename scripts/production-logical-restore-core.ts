import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

export type MigrationInventory = {
  names: string[];
  digest: string;
};

export type SourceMigrationInventory = MigrationInventory & {
  checksums: Record<string, string>;
};

export const productionBackupModes = ["PRE_MIGRATION_RELEASE", "POST_RELEASE"] as const;

export type ProductionBackupMode = typeof productionBackupModes[number];

export type BackupMigrationState = {
  productionMigrationInventory: MigrationInventory;
  pendingMigrationNames: string[];
  databaseMigrationStateDigest: string;
};

export type SourceSchemaInventory = MigrationInventory & {
  tables: string[];
  functions: string[];
  triggers: string[];
  constraints: string[];
};

export type MigrationRecord = {
  name: string;
  checksum: string | null;
  finishedAt: Date | string | null;
  rolledBackAt: Date | string | null;
  logs: string | null;
};

export type SanitizedDataCounts = {
  users: number;
  businesses: number;
  transactions: number;
  documents: number;
  journalEntries: number;
  journalLines: number;
};

export type LegacyLogicalBackupManifest = {
  schemaVersion: 2;
  timestamp: string;
  database: string;
  sourceCommit: string;
  postgresVersion: string;
  archiveSizeBytes: number;
  sha256: string;
  encryption: "AES-256-GCM+scrypt";
  migrationInventory: MigrationInventory;
  databaseMigrationStateDigest: string;
  dataCounts: SanitizedDataCounts;
  archive: string;
};

export type LogicalBackupManifest = {
  schemaVersion: 3;
  timestamp: string;
  database: string;
  backupMode: ProductionBackupMode;
  authorizedReleaseCommit: string;
  postgresVersion: string;
  archiveSizeBytes: number;
  sha256: string;
  encryption: "AES-256-GCM+scrypt";
  sourceMigrationInventory: MigrationInventory;
  productionMigrationInventory: MigrationInventory;
  pendingMigrationNames: string[];
  databaseMigrationStateDigest: string;
  dataCounts: SanitizedDataCounts;
  archive: string;
};

export type AnyLogicalBackupManifest = LegacyLogicalBackupManifest | LogicalBackupManifest;

export type LogicalBackupReceipt = {
  archiveKey: string;
  manifestKey: string;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function postgresIdentifier(value: string) {
  const bytes = Buffer.from(value, "utf8");
  return bytes.byteLength <= 63 ? value : bytes.subarray(0, 63).toString("utf8");
}

function capture(source: string, expression: RegExp) {
  return [...source.matchAll(expression)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}

function finalConstraintNames(source: string) {
  const names = new Set<string>();
  const events: Array<{ index: number; kind: "add" | "drop" | "rename"; name: string; next?: string }> = [];
  const addPatterns = [
    /(?:^|\n)\s*CONSTRAINT\s+"([^"]+)"/gim,
    /ADD\s+CONSTRAINT\s+"([^"]+)"/gim,
  ];
  for (const expression of addPatterns) {
    for (const match of source.matchAll(expression)) {
      events.push({ index: match.index ?? 0, kind: "add", name: postgresIdentifier(match[1]) });
    }
  }
  for (const match of source.matchAll(/DROP\s+CONSTRAINT\s+"([^"]+)"/gim)) {
    events.push({ index: match.index ?? 0, kind: "drop", name: postgresIdentifier(match[1]) });
  }
  for (const match of source.matchAll(/RENAME\s+CONSTRAINT\s+"([^"]+)"\s+TO\s+"([^"]+)"/gim)) {
    events.push({ index: match.index ?? 0, kind: "rename", name: postgresIdentifier(match[1]), next: postgresIdentifier(match[2]) });
  }
  for (const event of events.sort((left, right) => left.index - right.index)) {
    if (event.kind === "add") names.add(event.name);
    if (event.kind === "drop") names.delete(event.name);
    if (event.kind === "rename") {
      names.delete(event.name);
      names.add(event.next!);
    }
  }
  return uniqueSorted([...names]);
}

export function migrationInventoryFromNames(names: string[]): MigrationInventory {
  const ordered = [...names].sort((left, right) => left.localeCompare(right));
  if (!ordered.length || ordered.some((name) => !/^\d{14}_[a-z0-9_]+$/i.test(name))) {
    throw new Error("SOURCE_MIGRATION_INVENTORY_REFUSED");
  }
  return {
    names: ordered,
    digest: sha256(ordered.join("\n")),
  };
}

export function sourceMigrationInventoryFromChecksums(migrations: Array<{ name: string; checksum: string }>): SourceMigrationInventory {
  const names = migrations.map((migration) => migration.name);
  const inventory = migrationInventoryFromNames(names);
  if (names.length !== new Set(names).size || migrations.some((migration) => !migration.checksum)) {
    throw new Error("SOURCE_MIGRATION_INVENTORY_REFUSED");
  }
  const checksums = Object.fromEntries(migrations.map((migration) => [migration.name, migration.checksum]));
  if (Object.keys(checksums).length !== inventory.names.length) throw new Error("SOURCE_MIGRATION_INVENTORY_REFUSED");
  return { ...inventory, checksums };
}

export function deriveSourceMigrationInventory(projectRoot = process.cwd()): SourceMigrationInventory {
  const migrationsRoot = join(projectRoot, "prisma", "migrations");
  const names = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  return sourceMigrationInventoryFromChecksums(names.map((name) => ({
    name,
    checksum: createHash("sha256").update(readFileSync(join(migrationsRoot, name, "migration.sql"))).digest("hex"),
  })));
}

export function deriveSourceSchemaInventory(projectRoot = process.cwd()): SourceSchemaInventory {
  const migrationsRoot = join(projectRoot, "prisma", "migrations");
  const migrationInventory = deriveSourceMigrationInventory(projectRoot);
  const source = migrationInventory.names.map((name) => {
    const path = join(migrationsRoot, name, "migration.sql");
    return readFileSync(path, "utf8");
  }).join("\n");

  return {
    ...migrationInventory,
    tables: uniqueSorted(capture(source, /CREATE\s+TABLE\s+"([^"]+)"/gi).map(postgresIdentifier)),
    functions: uniqueSorted(capture(source, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?([a-z0-9_]+)"?\s*\(/gi).map(postgresIdentifier)),
    triggers: uniqueSorted(capture(source, /CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+"?([a-z0-9_]+)"?/gi).map(postgresIdentifier)),
    constraints: finalConstraintNames(source),
  };
}

export function databaseMigrationStateDigest(records: MigrationRecord[]) {
  return sha256([...records]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((record) => `${record.name}:${record.checksum ?? ""}`)
    .join("\n"));
}

export function assertCompletedMigrationState(
  expected: MigrationInventory,
  records: MigrationRecord[],
) {
  const names = records.map((record) => record.name);
  const actual = migrationInventoryFromNames(names);
  const incomplete = records.some((record) =>
    !record.checksum || !record.finishedAt || record.rolledBackAt || record.logs,
  );
  if (
    incomplete ||
    names.length !== new Set(names).size ||
    actual.digest !== expected.digest ||
    actual.names.length !== expected.names.length
  ) {
    throw new Error("DATABASE_MIGRATION_STATE_REFUSED");
  }
  return databaseMigrationStateDigest(records);
}

export function assertProductionBackupMode(value: string | undefined): ProductionBackupMode {
  if (!productionBackupModes.includes(value as ProductionBackupMode)) throw new Error("BACKUP_MODE_REFUSED");
  return value as ProductionBackupMode;
}

function inventoriesMatch(left: MigrationInventory, right: MigrationInventory) {
  return left.digest === right.digest && left.names.join("\n") === right.names.join("\n");
}

function assertInventoryShape(inventory: MigrationInventory) {
  const reconstructed = migrationInventoryFromNames(inventory.names);
  if (!inventoriesMatch(inventory, reconstructed)) throw new Error("BACKUP_MANIFEST_REFUSED");
}

export function assertBackupMigrationState({
  mode,
  source,
  records,
  authorizedReleaseCommit,
}: {
  mode: ProductionBackupMode;
  source: SourceMigrationInventory;
  records: MigrationRecord[];
  authorizedReleaseCommit: string;
}): BackupMigrationState {
  if (!/^[a-f0-9]{40}$/i.test(authorizedReleaseCommit)) throw new Error("BACKUP_SOURCE_COMMIT_REFUSED");
  assertInventoryShape(source);
  if (
    Object.keys(source.checksums).length !== source.names.length ||
    source.names.some((name) => !source.checksums[name])
  ) throw new Error("SOURCE_MIGRATION_INVENTORY_REFUSED");

  const names = records.map((record) => record.name);
  const productionMigrationInventory = migrationInventoryFromNames(names);
  const incomplete = records.some((record) =>
    !record.checksum || !record.finishedAt || record.rolledBackAt || record.logs,
  );
  const ordered = names.every((name, index) => index === 0 || names[index - 1].localeCompare(name) < 0);
  const isPrefix = productionMigrationInventory.names.every((name, index) => source.names[index] === name);
  const checksumsMatch = records.every((record) => record.checksum === source.checksums[record.name]);
  if (
    incomplete ||
    names.length !== new Set(names).size ||
    !ordered ||
    !isPrefix ||
    !checksumsMatch ||
    productionMigrationInventory.names.length > source.names.length ||
    (mode === "POST_RELEASE" && !inventoriesMatch(productionMigrationInventory, source))
  ) {
    throw new Error("DATABASE_MIGRATION_STATE_REFUSED");
  }

  return {
    productionMigrationInventory,
    pendingMigrationNames: source.names.slice(productionMigrationInventory.names.length),
    databaseMigrationStateDigest: databaseMigrationStateDigest(records),
  };
}

export function assertLogicalBackupManifest(
  value: unknown,
  expected: MigrationInventory,
): asserts value is AnyLogicalBackupManifest {
  if (!value || typeof value !== "object") throw new Error("BACKUP_MANIFEST_REFUSED");
  const manifest = value as Partial<AnyLogicalBackupManifest>;
  const counts = manifest.dataCounts;
  const countsAreValid = counts && Object.values(counts).every((count) => Number.isInteger(count) && count >= 0);
  if (manifest.schemaVersion === 3) {
    const source = manifest.sourceMigrationInventory;
    const production = manifest.productionMigrationInventory;
    const pending = manifest.pendingMigrationNames;
    if (
      manifest.database !== "capture_tracker_production" ||
      !productionBackupModes.includes(manifest.backupMode as ProductionBackupMode) ||
      !/^[a-f0-9]{40}$/i.test(manifest.authorizedReleaseCommit ?? "") ||
      !/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? "") ||
      typeof manifest.archiveSizeBytes !== "number" ||
      !Number.isInteger(manifest.archiveSizeBytes) ||
      manifest.archiveSizeBytes <= 0 ||
      manifest.encryption !== "AES-256-GCM+scrypt" ||
      !source || !production || !Array.isArray(pending) ||
      !/^[a-f0-9]{64}$/i.test(manifest.databaseMigrationStateDigest ?? "") ||
      !countsAreValid
    ) throw new Error("BACKUP_MANIFEST_REFUSED");
    assertInventoryShape(source);
    assertInventoryShape(production);
    if (
      !inventoriesMatch(source, expected) ||
      !production.names.every((name, index) => source.names[index] === name) ||
      pending.join("\n") !== source.names.slice(production.names.length).join("\n") ||
      (manifest.backupMode === "POST_RELEASE" && (!inventoriesMatch(production, source) || pending.length !== 0))
    ) throw new Error("BACKUP_MANIFEST_REFUSED");
    return;
  }
  const legacy = manifest as Partial<LegacyLogicalBackupManifest>;
  if (
    legacy.schemaVersion !== 2 ||
    legacy.database !== "capture_tracker_production" ||
    !/^[a-f0-9]{40}$/i.test(legacy.sourceCommit ?? "") ||
    !/^[a-f0-9]{64}$/i.test(legacy.sha256 ?? "") ||
    typeof legacy.archiveSizeBytes !== "number" ||
    !Number.isInteger(legacy.archiveSizeBytes) ||
    legacy.archiveSizeBytes <= 0 ||
    legacy.encryption !== "AES-256-GCM+scrypt" ||
    !legacy.migrationInventory ||
    !Array.isArray(legacy.migrationInventory.names) ||
    !inventoriesMatch(legacy.migrationInventory, expected) ||
    !/^[a-f0-9]{64}$/i.test(legacy.databaseMigrationStateDigest ?? "") ||
    !countsAreValid
  ) {
    throw new Error("BACKUP_MANIFEST_REFUSED");
  }
}

export function isExactSourceBackup(manifest: AnyLogicalBackupManifest) {
  return manifest.schemaVersion === 2 || manifest.backupMode === "POST_RELEASE";
}

export function assertRestoredBackupState({
  expected,
  manifest,
  records,
  counts,
}: {
  expected: MigrationInventory;
  manifest: AnyLogicalBackupManifest;
  records: MigrationRecord[];
  counts: SanitizedDataCounts;
}) {
  assertLogicalBackupManifest(manifest, expected);
  const restoredInventory = manifest.schemaVersion === 3 ? manifest.productionMigrationInventory : manifest.migrationInventory;
  if (assertCompletedMigrationState(restoredInventory, records) !== manifest.databaseMigrationStateDigest) {
    throw new Error("RESTORED_MIGRATION_STATE_REFUSED");
  }
  if (JSON.stringify(counts) !== JSON.stringify(manifest.dataCounts)) {
    throw new Error("RESTORED_DATA_COUNTS_REFUSED");
  }
}

export function assertRestoreTarget(value: string | undefined, platform = process.platform) {
  if (platform !== "linux") throw new Error("NATIVE_LINUX_REQUIRED");
  if (!value) throw new Error("RESTORE_TARGET_REQUIRED");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    Number(url.port || "5432") !== 5432 ||
    database !== "capture_tracker_restore_test"
  ) {
    throw new Error("RESTORE_TARGET_REFUSED");
  }
  return url;
}

export function assertLogicalBackupReceipt(value: unknown): asserts value is LogicalBackupReceipt {
  if (!value || typeof value !== "object") throw new Error("BACKUP_RECEIPT_REFUSED");
  const receipt = value as Partial<LogicalBackupReceipt>;
  const archiveKey = receipt.archiveKey;
  const manifestKey = receipt.manifestKey;
  if (
    typeof archiveKey !== "string" ||
    typeof manifestKey !== "string" ||
    !/^production\/(daily|pre-acceptance|restore-verification)\/capture-tracker-production-[A-Z0-9]+-[a-f0-9]{12}\.ctbackup$/i.test(archiveKey) ||
    manifestKey !== `${archiveKey}.json`
  ) {
    throw new Error("BACKUP_RECEIPT_REFUSED");
  }
}

export async function withTemporaryRecoveryArtifacts<T>(
  paths: string[],
  action: () => Promise<T>,
  temporaryRoot = "/dev/shm",
) {
  if (paths.some((path) => {
    const pathFromRoot = relative(temporaryRoot, path);
    return !pathFromRoot || pathFromRoot.startsWith("..") || pathFromRoot.includes("..\\") || pathFromRoot.includes("../");
  })) {
    throw new Error("TEMPORARY_ARTIFACT_REFUSED");
  }
  try {
    return await action();
  } finally {
    for (const path of paths) rmSync(path, { force: true });
  }
}
