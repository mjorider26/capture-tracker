import "server-only";

import { prisma } from "@/lib/prisma";
import type { BusinessRole } from "../../generated/prisma/client";
import { inferCsvMapping, normalizeImportRows, parseCsv, sourceHash, sourceSignature, type CsvMapping } from "./financial-ingestion-core";

type Actor = { businessId: string; actorUserId: string; role: BusinessRole };
type Preview = { importId: string; headers: string[]; mapping: CsvMapping; summary: { total: number; valid: number; invalid: number; new: number; duplicate: number; possibleDuplicate: number }; rows: Array<{ rowNumber: number; date: string; description: string; amount: string; direction: "INFLOW" | "OUTFLOW"; status: string; reason?: string }> };
const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);
const id = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(value);
const mappingFrom = (value: unknown): CsvMapping | null => {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const string = (key: keyof CsvMapping, required = false) => typeof v[key] === "string" && v[key].trim() ? v[key].trim() : required ? null : undefined;
  const dateColumn = string("dateColumn", true), descriptionColumn = string("descriptionColumn", true), amountColumn = string("amountColumn"), debitColumn = string("debitColumn"), creditColumn = string("creditColumn");
  if (!dateColumn || !descriptionColumn || (!amountColumn && !(debitColumn && creditColumn))) return null;
  return { dateColumn, descriptionColumn, amountColumn: amountColumn ?? undefined, debitColumn: debitColumn ?? undefined, creditColumn: creditColumn ?? undefined, postedDateColumn: string("postedDateColumn") ?? undefined, merchantColumn: string("merchantColumn") ?? undefined, externalIdColumn: string("externalIdColumn") ?? undefined, bankCategoryColumn: string("bankCategoryColumn") ?? undefined };
};

export async function createImportPreview(actor: Actor, input: { financialAccountId: string; sourceFilename: string; csvText: string; mapping?: unknown; profileId?: string }): Promise<{ ok: true; preview: Preview } | { ok: false; message: string }> {
  if (actor.role !== "OWNER" || !id(input.financialAccountId) || typeof input.sourceFilename !== "string" || input.sourceFilename.length > 180) return { ok: false, message: "The import request is invalid." };
  try {
    const parsed = parseCsv(input.csvText);
    const mapping = mappingFrom(input.mapping) ?? inferCsvMapping(parsed.headers);
    if (!mapping) return { ok: false, message: "Choose date, description, and amount columns before previewing this CSV." };
    if (!Object.values(mapping).filter(Boolean).every((column) => parsed.headers.includes(column!))) return { ok: false, message: "Each mapped column must come from this CSV." };
    const account = await prisma.financialAccount.findFirst({ where: { id: input.financialAccountId, businessId: actor.businessId, isActive: true, ownership: "BUSINESS" }, select: { id: true } });
    if (!account) return { ok: false, message: "Choose an active business financial account." };
    const normalized = normalizeImportRows(parsed.rows, mapping, account.id);
    const identities = normalized.rows.map((row) => row.externalTransactionId ? { externalTransactionId: row.externalTransactionId } : { fingerprint: row.fingerprint });
    const existing = identities.length ? await prisma.externalTransaction.findMany({ where: { businessId: actor.businessId, financialAccountId: account.id, OR: identities }, select: { id: true, externalTransactionId: true, fingerprint: true, transactionDate: true, amount: true } }) : [];
    const exact = new Map(existing.flatMap((row) => [[`id:${row.externalTransactionId ?? ""}`, row.id], [`fp:${row.fingerprint}`, row.id]]));
    const seen = new Map<string, string>();
    let duplicate = 0, possibleDuplicate = 0;
    const rows = normalized.rows.map((row) => {
      const identity = row.externalTransactionId ? `id:${row.externalTransactionId}` : `fp:${row.fingerprint}`;
      const prior = seen.get(identity) ?? exact.get(identity);
      seen.set(identity, prior ?? "current");
      if (prior) { duplicate += 1; return { rowNumber: row.rowNumber, date: row.transactionDate, description: row.description, amount: row.amount, direction: row.direction, status: "DUPLICATE", reason: "Same transaction identity already appears in this import or prior activity." }; }
      const close = existing.some((item) => item.transactionDate.toISOString().slice(0, 10) === row.transactionDate && item.amount.equals(row.amount));
      if (close) { possibleDuplicate += 1; return { rowNumber: row.rowNumber, date: row.transactionDate, description: row.description, amount: row.amount, direction: row.direction, status: "POSSIBLE_DUPLICATE", reason: "Same date and amount exist; review before posting." }; }
      return { rowNumber: row.rowNumber, date: row.transactionDate, description: row.description, amount: row.amount, direction: row.direction, status: "NEW" };
    });
    const record = await prisma.transactionImport.create({ data: { businessId: actor.businessId, financialAccountId: account.id, createdByUserId: actor.actorUserId, profileId: null, sourceFilename: input.sourceFilename.trim(), sourceSha256: sourceHash(input.csvText), mappingJson: mapping, rowCount: parsed.rows.length, newCount: normalized.rows.length - duplicate - possibleDuplicate, duplicateCount: duplicate, possibleDuplicateCount: possibleDuplicate, invalidCount: normalized.invalid.length, status: "PREVIEW_READY" }, select: { id: true } });
    return { ok: true, preview: { importId: record.id, headers: parsed.headers, mapping, summary: { total: parsed.rows.length, valid: normalized.rows.length, invalid: normalized.invalid.length, new: normalized.rows.length - duplicate - possibleDuplicate, duplicate, possibleDuplicate }, rows: [...rows, ...normalized.invalid.map((item) => ({ rowNumber: item.rowNumber, date: "", description: item.reason, amount: "", direction: "OUTFLOW" as const, status: "INVALID", reason: item.reason }))] } };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "The CSV could not be previewed safely." }; }
}

export async function confirmTransactionImport(actor: Actor, input: { importId: string; csvText: string; mapping?: unknown; saveProfileName?: string }): Promise<{ ok: true; importId: string; created: number } | { ok: false; message: string }> {
  if (actor.role !== "OWNER" || !id(input.importId) || typeof input.csvText !== "string") return { ok: false, message: "The import confirmation is invalid." };
  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.transactionImport.findFirst({ where: { id: input.importId, businessId: actor.businessId }, select: { id: true, financialAccountId: true, sourceSha256: true, mappingJson: true, status: true } });
      if (!record) return { ok: false as const, message: "That import preview is unavailable." };
      if (record.status === "COMPLETED") { const count = await tx.externalTransaction.count({ where: { businessId: actor.businessId, transactionImportId: record.id } }); return { ok: true as const, importId: record.id, created: count }; }
      if (record.status !== "PREVIEW_READY") return { ok: false as const, message: "This import is no longer ready for confirmation." };
      if (sourceHash(input.csvText) !== record.sourceSha256) return { ok: false as const, message: "The CSV changed after preview. Create a new preview before importing." };
      const parsed = parseCsv(input.csvText), mapping = mappingFrom(input.mapping) ?? mappingFrom(record.mappingJson);
      if (!mapping) return { ok: false as const, message: "The saved column mapping is invalid." };
      const normalized = normalizeImportRows(parsed.rows, mapping, record.financialAccountId);
      const profileName = typeof input.saveProfileName === "string" ? input.saveProfileName.trim().slice(0, 100) : "";
      if (profileName) await tx.transactionImportProfile.upsert({ where: { businessId_financialAccountId_sourceSignature: { businessId: actor.businessId, financialAccountId: record.financialAccountId, sourceSignature: sourceSignature(parsed.headers) } }, create: { businessId: actor.businessId, financialAccountId: record.financialAccountId, name: profileName, sourceSignature: sourceSignature(parsed.headers), mappingJson: mapping }, update: { name: profileName, mappingJson: mapping, isActive: true, version: { increment: 1 } } });
      const existing = await tx.externalTransaction.findMany({ where: { businessId: actor.businessId, financialAccountId: record.financialAccountId, OR: normalized.rows.map((row) => row.externalTransactionId ? { externalTransactionId: row.externalTransactionId } : { fingerprint: row.fingerprint }) }, select: { id: true, externalTransactionId: true, fingerprint: true, transactionDate: true, amount: true } });
      const rules = await tx.merchantCategoryRule.findMany({ where: { businessId: actor.businessId, isActive: true, OR: [{ financialAccountId: record.financialAccountId }, { financialAccountId: null }] }, orderBy: [{ financialAccountId: "desc" }, { createdAt: "asc" }] });
      const exact = new Map(existing.flatMap((row) => [[`id:${row.externalTransactionId ?? ""}`, row.id], [`fp:${row.fingerprint}`, row.id]])); const seen = new Map<string, string>();
      const created = [] as Array<{ id: string; suggestedLedgerAccountId: string | null }>;
      for (const row of normalized.rows) {
        const identity = row.externalTransactionId ? `id:${row.externalTransactionId}` : `fp:${row.fingerprint}`; const duplicateOfId = seen.get(identity) ?? exact.get(identity) ?? null; seen.set(identity, duplicateOfId ?? "current");
        const possible = !duplicateOfId && existing.some((item) => item.transactionDate.toISOString().slice(0, 10) === row.transactionDate && item.amount.equals(row.amount));
        const rule = !duplicateOfId && !possible ? rules.find((item) => item.normalizedMerchant === row.normalizedMerchant && (!item.direction || item.direction === row.direction)) : undefined;
        const status = duplicateOfId ? "DUPLICATE" : possible ? "POSSIBLE_DUPLICATE" : rule ? "SUGGESTED" : "NEEDS_REVIEW";
        const item = await tx.externalTransaction.create({ data: { businessId: actor.businessId, transactionImportId: record.id, financialAccountId: record.financialAccountId, rowNumber: row.rowNumber, transactionDate: dateAtNoon(row.transactionDate), postedDate: row.postedDate ? dateAtNoon(row.postedDate) : null, description: row.description, normalizedMerchant: row.normalizedMerchant, amount: row.amount, direction: row.direction, externalTransactionId: row.externalTransactionId, sourceReference: row.sourceReference, fingerprint: row.fingerprint, bankCategory: row.bankCategory, status, duplicateOfId, suggestedLedgerAccountId: rule?.ledgerAccountId, suggestionReason: rule ? `Matched your approved ${rule.mode === "AUTO_CLASSIFY" ? "automatic classification" : "suggestion"} rule for ${row.normalizedMerchant}.` : possible ? "Same date and amount exists in prior imported activity." : null }, select: { id: true, suggestedLedgerAccountId: true } });
        created.push(item); if (rule) await tx.merchantCategoryRule.update({ where: { id: rule.id }, data: { applicationCount: { increment: 1 } } });
      }
      await tx.transactionImport.update({ where: { id: record.id }, data: { status: "COMPLETED", confirmedAt: new Date(), completedAt: new Date(), rowCount: parsed.rows.length, newCount: created.filter((item) => item.suggestedLedgerAccountId || true).length, invalidCount: normalized.invalid.length, version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "TransactionImport", entityId: record.id, afterJson: { rowCount: parsed.rows.length, importedRows: created.length, invalidRows: normalized.invalid.length }, metadataJson: { sourceSha256: record.sourceSha256, accountingEffect: "none" } } });
      return { ok: true as const, importId: record.id, created: created.length };
    });
  } catch { return { ok: false, message: "The import could not be confirmed safely. Refresh and try again." }; }
}

export async function postExternalTransaction(actor: Actor, input: { externalTransactionId: string; ledgerAccountId: string; createRule?: boolean }): Promise<{ ok: true; transactionId: string } | { ok: false; message: string }> {
  if (actor.role !== "OWNER" || !id(input.externalTransactionId) || !id(input.ledgerAccountId)) return { ok: false, message: "The posting request is invalid." };
  try { return await prisma.$transaction(async (tx) => {
    const external = await tx.externalTransaction.findFirst({ where: { id: input.externalTransactionId, businessId: actor.businessId }, include: { financialAccount: { include: { ledgerAccount: true } } } });
    if (!external || ["POSTED", "DUPLICATE", "POSSIBLE_DUPLICATE", "INVALID", "IGNORED"].includes(external.status)) return { ok: false as const, message: "This imported activity cannot be posted." };
    const category = await tx.ledgerAccount.findFirst({ where: { id: input.ledgerAccountId, businessId: actor.businessId, isActive: true, financialAccountId: null, type: external.direction === "INFLOW" ? "INCOME" : "EXPENSE" }, select: { id: true, name: true } });
    if (!category || !external.financialAccount.ledgerAccount) return { ok: false as const, message: "Choose an active accounting category for this transaction." };
    const period = await tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: external.transactionDate }, endsAt: { gte: external.transactionDate } }, select: { id: true } });
    if (!period) return { ok: false as const, message: "The transaction date belongs to a closed accounting period." };
    const transaction = await tx.transaction.create({ data: { businessId: actor.businessId, accountId: external.financialAccountId, postedAt: external.transactionDate, description: external.description, merchantName: external.normalizedMerchant, amount: external.amount, direction: external.direction, intent: "BUSINESS", status: "APPROVED", sourceReference: external.externalTransactionId ?? `import:${external.id}`, approvedAt: new Date(), approvedByMembershipId: actor.actorUserId } });
    const journal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `IMP-${external.id}`, entryDate: external.transactionDate, description: external.description, status: "DRAFT", sourceType: "BANK_TRANSACTION", sourceEntityId: external.id, transactionId: transaction.id, approvedByMembershipId: actor.actorUserId } });
    const amount = external.amount.toFixed(2), cash = external.financialAccount.ledgerAccount.id;
    await tx.journalLine.createMany({ data: external.direction === "INFLOW" ? [{ businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: cash, lineNumber: 1, debitAmount: amount, creditAmount: "0", memo: "Imported bank deposit" }, { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: category.id, lineNumber: 2, debitAmount: "0", creditAmount: amount, memo: category.name }] : [{ businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: category.id, lineNumber: 1, debitAmount: amount, creditAmount: "0", memo: category.name }, { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: cash, lineNumber: 2, debitAmount: "0", creditAmount: amount, memo: "Imported bank payment" }] });
    await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
    const claimed = await tx.externalTransaction.updateMany({ where: { id: external.id, businessId: actor.businessId, postedTransactionId: null, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, data: { status: "POSTED", reviewLedgerAccountId: category.id, reviewedAt: new Date(), reviewedByUserId: actor.actorUserId, postedTransactionId: transaction.id, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Concurrent external transaction posting");
    if (input.createRule && external.normalizedMerchant) {
      const rule = await tx.merchantCategoryRule.findFirst({ where: { businessId: actor.businessId, financialAccountId: external.financialAccountId, normalizedMerchant: external.normalizedMerchant, direction: external.direction }, select: { id: true } });
      if (rule) await tx.merchantCategoryRule.update({ where: { id: rule.id }, data: { ledgerAccountId: category.id, isActive: true, version: { increment: 1 } } });
      else await tx.merchantCategoryRule.create({ data: { businessId: actor.businessId, financialAccountId: external.financialAccountId, normalizedMerchant: external.normalizedMerchant, direction: external.direction, ledgerAccountId: category.id, mode: "SUGGEST_ONLY" } });
    }
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "APPROVE", entityType: "ExternalTransaction", entityId: external.id, afterJson: { categoryAccountId: category.id, transactionId: transaction.id, journalEntryId: journal.id, merchantRuleCreated: Boolean(input.createRule && external.normalizedMerchant) }, metadataJson: { sourceImportId: external.transactionImportId, accountingEffect: "posted" } } });
    return { ok: true as const, transactionId: transaction.id };
  }); } catch { return { ok: false, message: "The transaction could not be posted safely. Refresh and try again." }; }
}

export async function ignoreExternalTransaction(actor: Actor, externalTransactionId: string): Promise<boolean> { if (actor.role !== "OWNER" || !id(externalTransactionId)) return false; const result = await prisma.externalTransaction.updateMany({ where: { id: externalTransactionId, businessId: actor.businessId, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "POSSIBLE_DUPLICATE"] }, postedTransactionId: null }, data: { status: "IGNORED", reviewedAt: new Date(), reviewedByUserId: actor.actorUserId, version: { increment: 1 } } }); return result.count === 1; }

export async function getImportWorkspace(businessId: string) { const [accounts, categories, imports, items, profiles] = await Promise.all([prisma.financialAccount.findMany({ where: { businessId, ownership: "BUSINESS", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }), prisma.ledgerAccount.findMany({ where: { businessId, isActive: true, financialAccountId: null, type: { in: ["INCOME", "EXPENSE"] } }, select: { id: true, name: true, type: true }, orderBy: { code: "asc" } }), prisma.transactionImport.findMany({ where: { businessId }, take: 12, orderBy: { createdAt: "desc" }, select: { id: true, sourceFilename: true, status: true, rowCount: true, newCount: true, duplicateCount: true, possibleDuplicateCount: true, invalidCount: true, createdAt: true, financialAccount: { select: { name: true } } } }), prisma.externalTransaction.findMany({ where: { businessId, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "POSSIBLE_DUPLICATE"] } }, take: 100, orderBy: [{ transactionDate: "asc" }, { id: "asc" }], select: { id: true, transactionDate: true, description: true, amount: true, direction: true, status: true, suggestionReason: true, suggestedLedgerAccountId: true, financialAccount: { select: { name: true } } } }), prisma.transactionImportProfile.findMany({ where: { businessId, isActive: true }, select: { id: true, name: true, financialAccountId: true, mappingJson: true }, orderBy: { name: "asc" } })]); return { accounts, categories, imports: imports.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })), items: items.map((item) => ({ ...item, date: item.transactionDate.toISOString().slice(0, 10), amount: item.amount.toFixed(2) })), profiles }; }
