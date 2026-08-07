import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
const prismaMock = vi.hoisted(() => ({ journalLine: { groupBy: vi.fn(), findMany: vi.fn() }, ledgerAccount: { findMany: vi.fn(), findFirst: vi.fn() } }));
vi.mock("../prisma", () => ({ prisma: prismaMock }));

import { csvCell, getFinancialReports, getReportAccountDetail, parseReportRange, reportCsv } from "./reports";

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

  it("calculates statement totals from grouped database results beyond the old 2,000-line cap", async () => {
    const decimal = (value: string) => new Prisma.Decimal(value);
    const grouped = [
      { ledgerAccountId: "cash", _sum: { debitAmount: decimal("20010.00"), creditAmount: decimal("0.00") }, _count: { _all: 2001 } },
      { ledgerAccountId: "income", _sum: { debitAmount: decimal("0.00"), creditAmount: decimal("20010.00") }, _count: { _all: 2001 } },
    ];
    prismaMock.journalLine.groupBy.mockResolvedValueOnce(grouped).mockResolvedValueOnce(grouped).mockResolvedValueOnce([]);
    prismaMock.ledgerAccount.findMany.mockResolvedValueOnce([
      { id: "cash", code: "1000", name: "Checking", type: "ASSET", normalBalance: "DEBIT" },
      { id: "income", code: "4000", name: "Revenue", type: "INCOME", normalBalance: "CREDIT" },
    ]);
    const reports = await getFinancialReports("business-a", { period: "custom", start: "2026-08-01", end: "2026-08-31" });
    expect(reports.profitAndLoss.totalIncome).toBe("20010.00");
    expect(reports.balanceSheet.totalAssets).toBe("20010.00");
    expect(reports.trialBalance).toMatchObject({ totalDebits: "20010.00", totalCredits: "20010.00", difference: "0.00" });
    expect(reports.cashActivity).toMatchObject({ inflows: "20010.00", endingCash: "20010.00" });
    expect(reports.profitAndLoss.income[0]).toMatchObject({ entryCount: 2001 });
    expect(prismaMock.journalLine.findMany).not.toHaveBeenCalled();
    expect(prismaMock.journalLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "business-a" }) }));
  });

  it("uses database pagination for supporting entries after the old 50-entry cap", async () => {
    prismaMock.ledgerAccount.findFirst.mockResolvedValueOnce({ id: "income", code: "4000", name: "Revenue" });
    prismaMock.journalLine.findMany.mockResolvedValueOnce(Array.from({ length: 51 }, (_, index) => ({ id: `line-${index}`, debitAmount: new Prisma.Decimal(0), creditAmount: new Prisma.Decimal(10), journalEntry: { id: `entry-${index}`, transactionId: null, entryDate: new Date(`2026-08-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`), description: `Entry ${index}` } })));
    const detail = await getReportAccountDetail("business-a", "income", "profit-and-loss", { period: "custom", start: "2026-08-01", end: "2026-08-31" });
    expect(detail).toMatchObject({ page: 1, pageSize: 50, hasNextPage: true });
    expect(detail?.entries).toHaveLength(50);
    expect(prismaMock.journalLine.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 51 }));
    expect(prismaMock.ledgerAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "income", businessId: "business-a" } }));
  });
});
