import { createHash } from "node:crypto";

import { Prisma } from "../../generated/prisma/client";

export type CsvMapping = {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  postedDateColumn?: string;
  merchantColumn?: string;
  externalIdColumn?: string;
  bankCategoryColumn?: string;
};

export type NormalizedImportRow = {
  rowNumber: number;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  normalizedMerchant: string | null;
  amount: string;
  direction: "INFLOW" | "OUTFLOW";
  externalTransactionId: string | null;
  sourceReference: string | null;
  bankCategory: string | null;
  fingerprint: string;
};

export type InvalidImportRow = { rowNumber: number; reason: string };

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const headerKey = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const value = (row: Record<string, string>, column: string | undefined) => column ? clean(row[column]) : "";

export function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  if (text.length === 0 || text.length > 2_000_000) throw new Error("The CSV must be between 1 byte and 2 MB.");
  const records: string[][] = [];
  let record: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { record.push(field); field = ""; }
    else if (char === "\n") { record.push(field.replace(/\r$/, "")); records.push(record); record = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("The CSV has an unterminated quoted value.");
  if (field.length || record.length) { record.push(field.replace(/\r$/, "")); records.push(record); }
  const headers = (records.shift() ?? []).map(clean);
  if (!headers.length || headers.some((item) => !item)) throw new Error("The CSV needs a complete header row.");
  if (new Set(headers.map(headerKey)).size !== headers.length) throw new Error("CSV headers must be unique.");
  if (records.length > 5_000) throw new Error("A single import can contain at most 5,000 rows.");
  return { headers, rows: records.filter((row) => row.some((item) => clean(item))).map((row) => Object.fromEntries(headers.map((header, index) => [header, clean(row[index])])) ) };
}

export function inferCsvMapping(headers: string[]): CsvMapping | null {
  const byHint = (...hints: string[]) => headers.find((header) => hints.includes(headerKey(header)));
  const dateColumn = byHint("date", "transactiondate", "transdate", "postingdate", "posteddate", "postdate");
  const descriptionColumn = byHint("description", "details", "memo", "transactiondescription", "payee", "merchant", "name");
  const amountColumn = byHint("amount", "transactionamount");
  const debitColumn = byHint("debit", "withdrawal", "debits", "moneyout");
  const creditColumn = byHint("credit", "deposit", "credits", "moneyin");
  if (!dateColumn || !descriptionColumn || (!amountColumn && !(debitColumn && creditColumn))) return null;
  return {
    dateColumn, descriptionColumn, amountColumn, debitColumn: amountColumn ? undefined : debitColumn, creditColumn: amountColumn ? undefined : creditColumn,
    postedDateColumn: byHint("postingdate", "posteddate", "postdate"), merchantColumn: byHint("merchant", "payee"),
    externalIdColumn: byHint("transactionid", "id", "reference", "referencenumber"), bankCategoryColumn: byHint("category", "bankcategory"),
  };
}

export function parseImportDate(raw: string): string | null {
  const normalized = clean(raw);
  const iso = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : us ? [Number(us[3]), Number(us[1]), Number(us[2])] : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, 12));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1]! - 1 && date.getUTCDate() === parts[2] ? date.toISOString().slice(0, 10) : null;
}

export function parseImportAmount(raw: string): string | null {
  let source = clean(raw).replace(/[$,]/g, "");
  if (/^\(.*\)$/.test(source)) source = `-${source.slice(1, -1)}`;
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(source)) return null;
  const amount = new Prisma.Decimal(source);
  return amount.abs().greaterThan(0) ? amount.abs().toFixed(2) : null;
}

export function normalizedMerchant(value: string): string | null {
  const normalized = clean(value).toUpperCase().replace(/\d+/g, "").replace(/[^A-Z]+/g, " ").trim();
  return normalized || null;
}

export function sourceHash(source: string) { return createHash("sha256").update(source).digest("hex"); }
export function sourceSignature(headers: string[]) { return sourceHash(headers.map(headerKey).join("|")); }
export function fingerprint(accountId: string, row: Pick<NormalizedImportRow, "transactionDate" | "amount" | "description" | "sourceReference">) { return sourceHash([accountId, row.transactionDate, row.amount, normalizedMerchant(row.description) ?? "", row.sourceReference ?? ""].join("|")); }

export function normalizeImportRows(rows: Array<Record<string, string>>, mapping: CsvMapping, accountId: string): { rows: NormalizedImportRow[]; invalid: InvalidImportRow[] } {
  if (!mapping.dateColumn || !mapping.descriptionColumn || (!mapping.amountColumn && !(mapping.debitColumn && mapping.creditColumn))) throw new Error("Choose date, description, and either amount or debit and credit columns.");
  const output: NormalizedImportRow[] = [], invalid: InvalidImportRow[] = [];
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2, date = parseImportDate(value(row, mapping.dateColumn)), description = value(row, mapping.descriptionColumn);
    const directAmount = mapping.amountColumn ? parseImportAmount(value(row, mapping.amountColumn)) : null;
    const debit = mapping.debitColumn ? parseImportAmount(value(row, mapping.debitColumn)) : null;
    const credit = mapping.creditColumn ? parseImportAmount(value(row, mapping.creditColumn)) : null;
    if (!date || !description || (mapping.amountColumn ? !directAmount : Boolean(debit) === Boolean(credit))) { invalid.push({ rowNumber, reason: !date ? "Invalid transaction date" : !description ? "Missing description" : "Enter one non-zero amount" }); continue; }
    const signed = mapping.amountColumn ? clean(value(row, mapping.amountColumn)).replace(/[$,]/g, "").startsWith("-") || /^\(.*\)$/.test(clean(value(row, mapping.amountColumn))) : Boolean(debit);
    const amount = directAmount ?? debit ?? credit!;
    const candidate = { rowNumber, transactionDate: date, postedDate: parseImportDate(value(row, mapping.postedDateColumn)), description, normalizedMerchant: normalizedMerchant(value(row, mapping.merchantColumn) || description), amount, direction: signed ? "OUTFLOW" as const : "INFLOW" as const, externalTransactionId: value(row, mapping.externalIdColumn) || null, sourceReference: value(row, mapping.externalIdColumn) || null, bankCategory: value(row, mapping.bankCategoryColumn) || null, fingerprint: "" };
    output.push({ ...candidate, fingerprint: fingerprint(accountId, candidate) });
  }
  return { rows: output, invalid };
}
