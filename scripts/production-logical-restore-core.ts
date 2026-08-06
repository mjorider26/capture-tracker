import { createHash } from "node:crypto";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";

export type MigrationInventory = {
  names: string[];
  digest: string;
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

export type LogicalBackupManifest = {
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

export function deriveSourceSchemaInventory(projectRoot = process.cwd()): SourceSchemaInventory {
  const migrationsRoot = join(projectRoot, "prisma", "migrations");
  const names = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const migrationInventory = migrationInventoryFromNames(names);
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

export function assertLogicalBackupManifest(
  value: unknown,
  expected: MigrationInventory,
): asserts value is LogicalBackupManifest {
  if (!value || typeof value !== "object") throw new Error("BACKUP_MANIFEST_REFUSED");
  const manifest = value as Partial<LogicalBackupManifest>;
  const counts = manifest.dataCounts;
  const countsAreValid = counts && Object.values(counts).every((count) => Number.isInteger(count) && count >= 0);
  if (
    manifest.schemaVersion !== 2 ||
    manifest.database !== "capture_tracker_production" ||
    !/^[a-f0-9]{40}$/i.test(manifest.sourceCommit ?? "") ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? "") ||
    typeof manifest.archiveSizeBytes !== "number" ||
    !Number.isInteger(manifest.archiveSizeBytes) ||
    manifest.archiveSizeBytes <= 0 ||
    manifest.encryption !== "AES-256-GCM+scrypt" ||
    !manifest.migrationInventory ||
    !Array.isArray(manifest.migrationInventory.names) ||
    manifest.migrationInventory.digest !== expected.digest ||
    manifest.migrationInventory.names.join("\n") !== expected.names.join("\n") ||
    !/^[a-f0-9]{64}$/i.test(manifest.databaseMigrationStateDigest ?? "") ||
    !countsAreValid
  ) {
    throw new Error("BACKUP_MANIFEST_REFUSED");
  }
}

export function assertRestoredBackupState({
  expected,
  manifest,
  records,
  counts,
}: {
  expected: MigrationInventory;
  manifest: LogicalBackupManifest;
  records: MigrationRecord[];
  counts: SanitizedDataCounts;
}) {
  assertLogicalBackupManifest(manifest, expected);
  if (assertCompletedMigrationState(expected, records) !== manifest.databaseMigrationStateDigest) {
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
