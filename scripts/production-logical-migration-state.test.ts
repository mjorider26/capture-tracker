import { describe, expect, it } from "vitest";

import {
  assertBackupMigrationState,
  assertLogicalBackupManifest,
  databaseMigrationStateDigest,
  deriveSourceMigrationInventory,
  sourceMigrationInventoryFromChecksums,
  type LogicalBackupManifest,
  type MigrationRecord,
} from "./production-logical-restore-core";

const source = sourceMigrationInventoryFromChecksums([
  { name: "20260801000000_first", checksum: "checksum-first" },
  { name: "20260802000000_second", checksum: "checksum-second" },
  { name: "20260803000000_v2_operational_independence", checksum: "checksum-v2" },
]);

function records(count = source.names.length): MigrationRecord[] {
  return source.names.slice(0, count).map((name) => ({
    name,
    checksum: source.checksums[name],
    finishedAt: new Date("2026-08-10T00:00:00.000Z"),
    rolledBackAt: null,
    logs: null,
  }));
}

function preMigrationManifest(): LogicalBackupManifest {
  const productionRecords = records(2);
  return {
    schemaVersion: 3,
    timestamp: "2026-08-13T00:00:00.000Z",
    database: "capture_tracker_production",
    backupMode: "PRE_MIGRATION_RELEASE",
    authorizedReleaseCommit: "a".repeat(40),
    postgresVersion: "17.10",
    archiveSizeBytes: 100,
    sha256: "b".repeat(64),
    encryption: "AES-256-GCM+scrypt",
    sourceMigrationInventory: { names: source.names, digest: source.digest },
    productionMigrationInventory: { names: source.names.slice(0, 2), digest: sourceMigrationInventoryFromChecksums(source.names.slice(0, 2).map((name) => ({ name, checksum: source.checksums[name] }))).digest },
    pendingMigrationNames: [source.names[2]],
    databaseMigrationStateDigest: databaseMigrationStateDigest(productionRecords),
    dataCounts: { users: 1, businesses: 1, transactions: 2, documents: 0, journalEntries: 2, journalLines: 4 },
    archive: "capture-tracker-production.ctbackup",
  };
}

describe("production backup migration release modes", () => {
  it("allows exact source inventory in pre-migration mode", () => {
    const state = assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: records(), authorizedReleaseCommit: "a".repeat(40) });
    expect(state.pendingMigrationNames).toEqual([]);
  });

  it("allows a valid completed production prefix and identifies exact pending migrations", () => {
    const state = assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: records(2), authorizedReleaseCommit: "a".repeat(40) });
    expect(state.productionMigrationInventory.names).toEqual(source.names.slice(0, 2));
    expect(state.pendingMigrationNames).toEqual([source.names[2]]);
  });

  it("models the current V2.2 release boundary with 25 production migrations and three exact pending migrations", () => {
    const currentSource = deriveSourceMigrationInventory();
    const currentRecords = currentSource.names.slice(0, 25).map((name) => ({
      name,
      checksum: currentSource.checksums[name],
      finishedAt: new Date("2026-08-10T00:00:00.000Z"),
      rolledBackAt: null,
      logs: null,
    }));
    const state = assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source: currentSource, records: currentRecords, authorizedReleaseCommit: "a".repeat(40) });
    expect(currentSource.names).toHaveLength(28);
    expect(state.productionMigrationInventory.names).toHaveLength(25);
    expect(state.pendingMigrationNames).toEqual([
      "20260811090000_add_operational_independence",
      "20260812090000_authoritative_operational_posting",
      "20260813090000_add_cpa_document_policy",
    ]);
  });

  it("fails closed for a production migration absent from source or ahead of source", () => {
    expect(() => assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: [...records(), { ...records()[2], name: "20260804000000_unknown" }], authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(() => assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source: sourceMigrationInventoryFromChecksums(source.names.slice(0, 2).map((name) => ({ name, checksum: source.checksums[name] }))), records: records(), authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
  });

  it("fails closed for checksum divergence, failed history, and an invalid pending boundary", () => {
    expect(() => assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: [{ ...records()[0], checksum: "changed" }, ...records().slice(1)], authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(() => assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: [{ ...records()[0], logs: "failed" }], authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(() => assertBackupMigrationState({ mode: "PRE_MIGRATION_RELEASE", source, records: [records()[0], records()[2]], authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
  });

  it("keeps post-release mode exact-source only", () => {
    expect(() => assertBackupMigrationState({ mode: "POST_RELEASE", source, records: records(2), authorizedReleaseCommit: "a".repeat(40) })).toThrow("DATABASE_MIGRATION_STATE_REFUSED");
    expect(assertBackupMigrationState({ mode: "POST_RELEASE", source, records: records(), authorizedReleaseCommit: "a".repeat(40) }).pendingMigrationNames).toEqual([]);
  });

  it("records a pre-migration manifest with the authorized SHA, production boundary, source inventory, and pending names", () => {
    const manifest = preMigrationManifest();
    expect(() => assertLogicalBackupManifest(manifest, source)).not.toThrow();
    expect(manifest.authorizedReleaseCommit).toBe("a".repeat(40));
    expect(manifest.productionMigrationInventory.names).toHaveLength(2);
    expect(manifest.sourceMigrationInventory.names).toHaveLength(3);
    expect(manifest.pendingMigrationNames).toEqual([source.names[2]]);
  });
});
