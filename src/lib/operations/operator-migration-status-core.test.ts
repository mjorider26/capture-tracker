import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { deriveSourceMigrationInventory } from "../../../scripts/production-logical-restore-core";
import {
  evaluateOperatorMigrationStatus,
  type OperatorMigrationRecord,
} from "./operator-migration-status-core";

const actualSource = deriveSourceMigrationInventory();
const actualCompleted = actualSource.names.map((name): OperatorMigrationRecord => ({
  name,
  checksum: actualSource.checksums[name],
  finishedAt: new Date("2026-08-12T00:00:00.000Z"),
  rolledBackAt: null,
  logs: null,
}));

function fixture(count: number) {
  const names = Array.from({ length: count }, (_, index) => `${String(index + 1).padStart(14, "0")}_migration_${index + 1}`);
  const source = { names, checksums: Object.fromEntries(names.map((name, index) => [name, (index + 1).toString(16).padStart(64, "0")])) };
  const completed = names.map((name): OperatorMigrationRecord => ({
    name,
    checksum: source.checksums[name],
    finishedAt: new Date("2026-08-12T00:00:00.000Z"),
    rolledBackAt: null,
    logs: null,
  }));
  return { source, completed };
}

const thirty = fixture(30);

describe("operator migration status", () => {
  it("reports the canonical 30-migration source and production inventory as current", () => {
    expect(evaluateOperatorMigrationStatus(thirty.source, thirty.completed)).toEqual({
      status: "Current",
      sourceCount: 30,
      productionCount: 30,
      pendingCount: 0,
      divergent: false,
    });
  });

  it("reports one pending migration when production is a valid 29-migration prefix", () => {
    expect(evaluateOperatorMigrationStatus(thirty.source, thirty.completed.slice(0, 29))).toMatchObject({
      status: "Attention",
      sourceCount: 30,
      productionCount: 29,
      pendingCount: 1,
      divergent: false,
    });
  });

  it("fails closed for an unexpected or checksum-divergent production history", () => {
    const unexpected = [...thirty.completed.slice(0, 29), { ...thirty.completed[29], name: "20260815090000_unexpected_migration" }];
    expect(evaluateOperatorMigrationStatus(thirty.source, unexpected)).toMatchObject({
      status: "Attention",
      productionCount: 30,
      pendingCount: null,
      divergent: true,
    });
    expect(evaluateOperatorMigrationStatus(thirty.source, [{ ...thirty.completed[0], checksum: "0".repeat(64) }, ...thirty.completed.slice(1)])).toMatchObject({
      status: "Attention",
      pendingCount: null,
      divergent: true,
    });
  });

  it("derives the expectation at build time instead of using a stale count literal", () => {
    const page = readFileSync("src/app/operator/status/page.tsx", "utf8");
    const nextConfig = readFileSync("next.config.ts", "utf8");
    expect(page).not.toMatch(/migrationRows[^\n]*===\s*\d+/u);
    expect(nextConfig).toContain("deriveSourceMigrationInventory(projectRoot)");
    expect(nextConfig).toContain("CAPTURE_TRACKER_SOURCE_MIGRATION_INVENTORY");
    expect(evaluateOperatorMigrationStatus(actualSource, actualCompleted)).toMatchObject({
      status: "Current",
      sourceCount: actualSource.names.length,
      productionCount: actualSource.names.length,
      pendingCount: 0,
    });
  });
});
