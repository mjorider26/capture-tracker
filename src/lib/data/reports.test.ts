import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../prisma", () => ({ prisma: {} }));

import { csvCell, parseReportRange, reportCsv } from "./reports";

const report = {
  range: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T23:59:59.999Z", label: "2026-08-01 to 2026-08-31", period: "custom" as const },
  profitAndLoss: { income: [{ code: "4000", name: "=Formula income", type: "INCOME", debit: "0.00", credit: "10.00", balance: "10.00", entries: [] }], expenses: [], totalIncome: "10.00", totalExpenses: "0.00", netIncome: "10.00" },
  balanceSheet: { assets: [], liabilities: [], equity: [], totalAssets: "10.00", totalLiabilitiesAndEquity: "10.00", difference: "0.00" },
  trialBalance: { rows: [{ code: "1000", name: "Checking", type: "ASSET", debit: "10.00", credit: "0.00", balance: "10.00", entries: [] }], totalDebits: "10.00", totalCredits: "10.00", difference: "0.00" },
  cashActivity: { openingCash: "0.00", inflows: "10.00", outflows: "0.00", netChange: "10.00", endingCash: "10.00" },
};

describe("financial report boundaries and CSV", () => {
  it("uses inclusive UTC day boundaries for a custom reporting period", () => {
    const range = parseReportRange({ period: "custom", start: "2026-08-01", end: "2026-08-31" }, new Date("2026-09-15T12:00:00.000Z"));
    expect(range).toMatchObject({ period: "custom", start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-08-31T23:59:59.999Z") });
  });

  it("exports stable report headers, escaped cells, zero-safe rows, and formula-safe text", () => {
    expect(csvCell(" =SUM(A1:A2)")).toBe("' =SUM(A1:A2)");
    expect(csvCell('A "quoted" value')).toBe('A ""quoted"" value');
    const csv = reportCsv(report as never, "profit-and-loss");
    expect(csv.split("\r\n")[0]).toBe('"Report","Period","Account code","Account name","Debit","Credit","Balance"');
    expect(csv).toContain("'=Formula income");
    expect(reportCsv({ ...report, trialBalance: { ...report.trialBalance, rows: [] } } as never, "trial-balance").split("\r\n")).toHaveLength(1);
    expect(reportCsv(report as never, "cash-activity")).toContain('"Ending cash"');
  });
});
