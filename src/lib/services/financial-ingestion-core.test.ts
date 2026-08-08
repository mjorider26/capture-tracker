import { describe, expect, it } from "vitest";
import { inferCsvMapping, normalizeImportRows, parseCsv, parseImportDate } from "./financial-ingestion-core";

describe("financial ingestion CSV normalization", () => {
  it("supports quoted descriptions and signed amount exports", () => {
    const parsed = parseCsv('Date,Description,Amount,Transaction ID\n08/01/2026,"Adobe, Inc.",-54.99,abc-1\n');
    const mapping = inferCsvMapping(parsed.headers)!;
    const result = normalizeImportRows(parsed.rows, mapping, "account");
    expect(result.invalid).toEqual([]);
    expect(result.rows[0]).toMatchObject({ transactionDate: "2026-08-01", description: "Adobe, Inc.", amount: "54.99", direction: "OUTFLOW", externalTransactionId: "abc-1" });
  });
  it("requires exactly one debit or credit value", () => {
    const parsed = parseCsv("Posted Date,Description,Debit,Credit\n2026-08-01,Office supplies,21.00,\n2026-08-02,Bad,2.00,5.00\n");
    const result = normalizeImportRows(parsed.rows, inferCsvMapping(parsed.headers)!, "account");
    expect(result.rows).toHaveLength(1); expect(result.rows[0]?.direction).toBe("OUTFLOW"); expect(result.invalid).toHaveLength(1);
  });
  it("rejects impossible dates", () => expect(parseImportDate("2026-02-31")).toBeNull());
});
