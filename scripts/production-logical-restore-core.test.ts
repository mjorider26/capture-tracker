import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertCompletedMigrationState,
  assertLogicalBackupManifest,
  assertLogicalBackupReceipt,
  assertRestoreTarget,
  assertRestoredBackupState,
  databaseMigrationStateDigest,
  deriveSourceSchemaInventory,
  migrationInventoryFromNames,
  withTemporaryRecoveryArtifacts,
  type LogicalBackupManifest,
  type MigrationRecord,
} from "./production-logical-restore-core";

const expected = migrationInventoryFromNames([
  "20260801000000_first",
  "20260802000000_second",
  "20260803000000_future",
]);

const records: MigrationRecord[] = expected.names.map((name, index) => ({
  name,
  checksum: `checksum-${index}`,
  finishedAt: new Date(),
  rolledBackAt: null,
  logs: null,
}));

function manifest(): LogicalBackupManifest {
  return {
    schemaVersion: 2,
    timestamp: "2026-08-06T00:00:00.000Z",
    database: "capture_tracker_production",
    sourceCommit: "a".repeat(40),
    postgresVersion: "17.10",
    archiveSizeBytes: 100,
    sha256: "b".repeat(64),
    encryption: "AES-256-GCM+scrypt",
    migrationInventory: expected,
    databaseMigrationStateDigest: databaseMigrationStateDigest(records),
    dataCounts: { users: 1, businesses: 1, transactions: 2, documents: 0, journalEntries: 2, journalLines: 4 },
    archive: "capture-tracker-production.ctbackup",
  };
}

describe("production logical restore source-derived verification", () => {
  it("derives the current repository inventory without a maintained migration count", () => {
    const inventory = deriveSourceSchemaInventory();
    const reconstructed = migrationInventoryFromNames(inventory.names);
    expect(reconstructed.digest).toBe(inventory.digest);
    expect(inventory.names.at(-1)).toBe("20260805190000_add_production_owner_bootstrap");
    expect(inventory.tables).toContain("ProductionBootstrap");
    expect(inventory.functions.length).toBeGreaterThan(0);
    expect(inventory.triggers.length).toBeGreaterThan(0);
    expect(inventory.constraints.length).toBeGreaterThan(0);
    expect(inventory.constraints).not.toContain("Document_metadata_only_integrity");
    expect(inventory.constraints.every((name) => Buffer.byteLength(name, "utf8") <= 63)).toBe(true);
  });

  it("accepts the ordered source inventory without a numeric migration literal", () => {
    expect(assertCompletedMigrationState(expected, [...records].reverse())).toBe(databaseMigrationStateDigest(records));
    expect(expected.names).toHaveLength(3);
  });

  it("rejects missing, failed, or rolled-back migrations", () => {
    expect(() => assertCompletedMigrationState(expected, records.slice(1))).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(() => assertCompletedMigrationState(expected, [{ ...records[0], logs: "failed" }, ...records.slice(1)])).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(() => assertCompletedMigrationState(expected, [{ ...records[0], rolledBackAt: new Date() }, ...records.slice(1)])).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
  });

  it("rejects malformed, source-mismatched, and data-mismatched manifests", () => {
    expect(() => assertLogicalBackupManifest(manifest(), expected)).not.toThrow();
    expect(() => assertLogicalBackupManifest({ ...manifest(), schemaVersion: 1 }, expected)).toThrow("BACKUP_MANIFEST_REFUSED");
    expect(() => assertLogicalBackupManifest({ ...manifest(), migrationInventory: { ...expected, digest: "c".repeat(64) } }, expected)).toThrow("BACKUP_MANIFEST_REFUSED");
    expect(() => assertRestoredBackupState({ expected, manifest: { ...manifest(), databaseMigrationStateDigest: "d".repeat(64) }, records, counts: manifest().dataCounts })).toThrow("RESTORED_MIGRATION_STATE_REFUSED");
    expect(() => assertRestoredBackupState({ expected, manifest: manifest(), records, counts: { ...manifest().dataCounts, documents: 1 } })).toThrow("RESTORED_DATA_COUNTS_REFUSED");
  });

  it("refuses production, staging, and unrelated restore targets", () => {
    const productionTarget = "postgresql://user:pass@127.0.0.1:5432/capture_tracker_" + "production";
    expect(() => assertRestoreTarget(productionTarget, "linux")).toThrow("RESTORE_TARGET_REFUSED");
    expect(() => assertRestoreTarget("postgresql://user:pass@127.0.0.1/capture_tracker_staging", "linux")).toThrow("RESTORE_TARGET_REFUSED");
    expect(assertRestoreTarget("postgresql://user:pass@127.0.0.1:5432/capture_tracker_restore_test", "linux").pathname).toBe("/capture_tracker_restore_test");
  });

  it("accepts only a paired backup-bucket receipt", () => {
    const archiveKey = "production/daily/capture-tracker-production-20260806T010203000Z-aaaaaaaaaaaa.ctbackup";
    expect(() => assertLogicalBackupReceipt({ archiveKey, manifestKey: `${archiveKey}.json` })).not.toThrow();
    expect(() => assertLogicalBackupReceipt({ archiveKey: "production/daily/not-allowed.ctbackup", manifestKey: "production/daily/not-allowed.ctbackup.json" })).toThrow("BACKUP_RECEIPT_REFUSED");
  });

  it("removes temporary artifacts after success and failure without touching unrelated files", async () => {
    const root = mkdtempSync(join(tmpdir(), "capture-tracker-restore-"));
    const expected = join(root, "temporary.dump");
    const unrelated = join(root, "unrelated.txt");
    try {
      writeFileSync(expected, "temporary");
      writeFileSync(unrelated, "keep");
      await withTemporaryRecoveryArtifacts([expected], async () => undefined, root);
      expect(() => readFileSync(expected)).toThrow();
      expect(readFileSync(unrelated, "utf8")).toBe("keep");

      writeFileSync(expected, "temporary");
      await expect(withTemporaryRecoveryArtifacts([expected], async () => {
        throw new Error("restore failure");
      }, root)).rejects.toThrow("restore failure");
      expect(() => readFileSync(expected)).toThrow();
      expect(readFileSync(unrelated, "utf8")).toBe("keep");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
