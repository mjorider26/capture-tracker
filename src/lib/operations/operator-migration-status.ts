import "server-only";

import {
  evaluateOperatorMigrationStatus,
  type OperatorMigrationRecord,
  type OperatorSourceMigrationInventory,
} from "./operator-migration-status-core";

function sourceMigrationInventory(): OperatorSourceMigrationInventory {
  try {
    const parsed = JSON.parse(process.env.CAPTURE_TRACKER_SOURCE_MIGRATION_INVENTORY ?? "") as OperatorSourceMigrationInventory;
    if (!parsed || !Array.isArray(parsed.names) || !parsed.checksums || typeof parsed.checksums !== "object") throw new Error();
    return parsed;
  } catch {
    throw new Error("SOURCE_MIGRATION_INVENTORY_UNAVAILABLE");
  }
}

export function operatorMigrationStatus(records: OperatorMigrationRecord[]) {
  return evaluateOperatorMigrationStatus(sourceMigrationInventory(), records);
}
