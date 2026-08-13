export type OperatorSourceMigrationInventory = {
  names: string[];
  checksums: Record<string, string>;
};

export type OperatorMigrationRecord = {
  name: string;
  checksum: string | null;
  finishedAt: Date | string | null;
  rolledBackAt: Date | string | null;
  logs: string | null;
};

export type OperatorMigrationStatus = {
  status: "Current" | "Attention";
  sourceCount: number;
  productionCount: number;
  pendingCount: number | null;
  divergent: boolean;
};

const migrationName = /^\d{14}_[a-z0-9_]+$/iu;
const checksum = /^[a-f0-9]{64}$/iu;

function assertSourceInventory(source: OperatorSourceMigrationInventory) {
  const sorted = [...source.names].sort((left, right) => left.localeCompare(right));
  if (
    source.names.length === 0 ||
    new Set(source.names).size !== source.names.length ||
    source.names.some((name) => !migrationName.test(name) || !checksum.test(source.checksums[name] ?? "")) ||
    sorted.some((name, index) => name !== source.names[index])
  ) {
    throw new Error("SOURCE_MIGRATION_INVENTORY_REFUSED");
  }
}

export function evaluateOperatorMigrationStatus(
  source: OperatorSourceMigrationInventory,
  records: OperatorMigrationRecord[],
): OperatorMigrationStatus {
  assertSourceInventory(source);
  const production = [...records].sort((left, right) => left.name.localeCompare(right.name));
  const unique = new Set(production.map((record) => record.name)).size === production.length;
  const validPrefix = unique && production.every((record, index) =>
    source.names[index] === record.name &&
    source.checksums[record.name] === record.checksum &&
    Boolean(record.finishedAt) &&
    !record.rolledBackAt &&
    !record.logs,
  );
  const pendingCount = validPrefix && production.length <= source.names.length
    ? source.names.length - production.length
    : null;
  const current = pendingCount === 0;

  return {
    status: current ? "Current" : "Attention",
    sourceCount: source.names.length,
    productionCount: production.length,
    pendingCount,
    divergent: pendingCount === null,
  };
}
