import { spawn } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  assertCleanupEnvironment,
  assertDirectProductionUrl,
  assertExecutionIntent,
  assertTenantIdentity,
  productionAcceptance,
  reservedR2Prefix,
} from "./production-acceptance-cleanup-core";

type Db = PrismaClient;
type Count = { table: string; count: number };

function safeIdentifier(value: string) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) throw new Error("DATABASE_IDENTIFIER_REFUSED");
  return `"${value}"`;
}

export async function scopedTableOrder(db: Db) {
  const tables = await db.$queryRaw<Array<{ table: string }>>`
    SELECT c.table_name AS "table"
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'businessId'
    ORDER BY c.table_name
  `;
  const names = new Set(tables.map(({ table }) => table));
  const edges = await db.$queryRaw<Array<{ child: string; parent: string }>>`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    WHERE fk.contype = 'f' AND ns.nspname = 'public'
  `;
  const parents = new Map<string, Set<string>>([...names].map((name) => [name, new Set()]));
  // These optional references form intentional application-level cycles. They
  // are nulled inside the cleanup transaction before the scoped delete order
  // is evaluated, so they must not make the dependency graph look unsafe.
  const brokenCycles = new Set(["AskAiMessage:AskAiRun", "Transaction:JournalEntry", "AccountingPolicy:AccountingPolicyVersion"]);
  for (const { child, parent } of edges) {
    if (names.has(child) && names.has(parent) && child !== parent && !brokenCycles.has(`${child}:${parent}`)) parents.get(child)!.add(parent);
  }
  const ordered: string[] = [];
  const remaining = new Set(names);
  while (remaining.size) {
    const ready = [...remaining].filter((table) => [...parents.get(table)!].every((parent) => !remaining.has(parent)));
    if (!ready.length) throw new Error("SCOPED_TABLE_ORDER_REFUSED");
    for (const table of ready.sort()) { ordered.push(table); remaining.delete(table); }
  }
  return ordered.reverse();
}

export async function scopedCounts(db: Db, businessId: string) {
  const counts: Count[] = [];
  for (const table of await scopedTableOrder(db)) {
    const result = await db.$queryRawUnsafe<Array<{ count: string }>>(`SELECT count(*)::text AS count FROM ${safeIdentifier(table)} WHERE "businessId" = $1`, businessId);
    const count = Number(result[0]?.count ?? "0");
    if (count) counts.push({ table, count });
  }
  return counts;
}

async function r2Command(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "r2", "object", ...args], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let error = "";
    child.stderr.on("data", (chunk) => { error += String(chunk); });
    child.once("error", () => reject(new Error("R2_OPERATION_FAILED")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(error.includes("Authentication") ? "R2_AUTHORIZATION_FAILED" : "R2_OPERATION_FAILED")));
  });
}

export async function removeExactR2Objects(keys: string[]) {
  for (const key of keys) await r2Command(["delete", `${productionAcceptance.bucket}/active/${key}`, "--remote", "--force"]);
  for (const key of keys) {
    try { await r2Command(["get", `${productionAcceptance.bucket}/active/${key}`, "--remote", "--file", process.platform === "win32" ? "NUL" : "/dev/null"]); }
    catch { continue; }
    throw new Error("R2_OBJECT_STILL_PRESENT");
  }
}

export async function deleteTenant(db: Db, businessId: string, userId: string) {
  const tables = await scopedTableOrder(db);
  await db.$transaction(async (tx) => {
    // Break only optional, intra-tenant cycles. Every statement is still
    // constrained by the exact business id and happens in one transaction.
    await tx.$executeRawUnsafe('UPDATE "AskAiMessage" SET "runId" = NULL WHERE "businessId" = $1', businessId);
    await tx.$executeRawUnsafe('UPDATE "Transaction" SET "correctionReversalJournalId" = NULL WHERE "businessId" = $1', businessId);
    await tx.$executeRawUnsafe('UPDATE "AccountingPolicy" SET "currentVersionId" = NULL WHERE "businessId" = $1', businessId);
    // A deferred split trigger intentionally rejects a mixed transaction
    // without its full split set. Make each target transaction non-mixed
    // before removing its scoped splits, then flush that invariant while the
    // parent still exists. This is a cleanup-only state transition inside the
    // transaction; no partially changed record can commit.
    await tx.$executeRawUnsafe('UPDATE "Transaction" SET "intent" = \'UNREVIEWED\' WHERE "businessId" = $1', businessId);
    for (const table of tables) {
      if (table === "Transaction") await tx.$executeRawUnsafe('SET CONSTRAINTS transaction_split_sum_matches_total, parent_transaction_split_state_is_valid IMMEDIATE');
      await tx.$executeRawUnsafe(`DELETE FROM ${safeIdentifier(table)} WHERE "businessId" = $1`, businessId);
    }
    await tx.$executeRawUnsafe('DELETE FROM "Session" WHERE "userId" = $1', userId);
    await tx.$executeRawUnsafe('DELETE FROM "Account" WHERE "userId" = $1', userId);
    await tx.$executeRawUnsafe('DELETE FROM "Verification" WHERE "identifier" = $1', productionAcceptance.email);
    await tx.user.delete({ where: { id: userId } });
    await tx.business.delete({ where: { id: businessId } });
  });
}

export async function main() {
  if (process.platform !== "linux") throw new Error("NATIVE_LINUX_REQUIRED");
  assertCleanupEnvironment(process.env);
  const execute = assertExecutionIntent(process.argv.slice(2));
  const direct = assertDirectProductionUrl(process.env.CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL);
  const pool = new Pool({ connectionString: direct.href });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const user = await db.user.findUnique({ where: { email: productionAcceptance.email }, select: { id: true, email: true, displayName: true } });
    const businessId = user ? `practice-${user.id}` : "";
    const [business, memberships] = await Promise.all([
      businessId ? db.business.findUnique({ where: { id: businessId }, select: { id: true, legalName: true, displayName: true } }) : null,
      user ? db.businessMember.findMany({ where: { userId: user.id }, select: { businessId: true } }) : [],
    ]);
    const target = assertTenantIdentity({ user, business, memberships });
    const documents = await db.document.findMany({ where: { businessId: target.businessId, storageKey: { not: null } }, select: { storageKey: true } });
    const prefix = reservedR2Prefix(target.businessId).slice("active/".length);
    const keys = documents.map((document) => document.storageKey!).filter(Boolean);
    if (keys.some((key) => !key.startsWith(prefix))) throw new Error("R2_PREFIX_REFUSED");
    const counts = await scopedCounts(db, target.businessId);
    console.log(`CLEANUP ${execute ? "EXECUTION" : "DRY_RUN"}: targetTables=${counts.length} targetRecords=${counts.reduce((total, count) => total + count.count, 0)} r2Objects=${keys.length}`);
    if (!execute) return;
    await removeExactR2Objects(keys);
    await deleteTenant(db, target.businessId, target.userId);
    const [remainingUser, remainingBusiness, remainingRows] = await Promise.all([
      db.user.count({ where: { id: target.userId } }),
      db.business.count({ where: { id: target.businessId } }),
      scopedCounts(db, target.businessId),
    ]);
    if (remainingUser || remainingBusiness || remainingRows.length) throw new Error("POST_CLEANUP_VERIFICATION_FAILED");
    console.log("CLEANUP EXECUTION VERIFIED: reserved fictional tenant removed; schema and unrelated tenants untouched.");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(() => { console.error("CLEANUP REFUSED OR FAILED; no broad reset was attempted."); process.exitCode = 1; });
}
