import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";

const zero = new Prisma.Decimal(0);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const pageSize = 50;
export type ReportKind = "profit-and-loss" | "balance-sheet" | "trial-balance" | "cash-activity";
export type ReportRange = { start: Date; end: Date; label: string; period: "month" | "last-month" | "quarter" | "ytd" | "previous-year" | "custom" };
type ReportAccount = { id: string; code: string; name: string; type: string; normalBalance: string };
type Aggregate = { ledgerAccountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; entryCount: number };

export function parseReportRange(raw: Record<string, string | string[] | undefined>, now = new Date()): ReportRange {
  const value = (key: string) => typeof raw[key] === "string" ? raw[key]!.trim() : "";
  const period = value("period") || "month"; const customStart = value("start"); const customEnd = value("end");
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  let start = monthStart; let end = day; let label = "This month"; let selected: ReportRange["period"] = "month";
  if (period === "last-month") { selected = "last-month"; start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() - 1, 1)); end = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 0)); label = "Last month"; }
  else if (period === "quarter") { selected = "quarter"; const q = Math.floor(day.getUTCMonth() / 3) * 3; start = new Date(Date.UTC(day.getUTCFullYear(), q, 1)); label = "This quarter"; }
  else if (period === "ytd") { selected = "ytd"; start = new Date(Date.UTC(day.getUTCFullYear(), 0, 1)); label = "Year to date"; }
  else if (period === "previous-year") { selected = "previous-year"; start = new Date(Date.UTC(day.getUTCFullYear() - 1, 0, 1)); end = new Date(Date.UTC(day.getUTCFullYear() - 1, 11, 31)); label = "Previous year"; }
  else if (period === "custom" && datePattern.test(customStart) && datePattern.test(customEnd)) { selected = "custom"; start = new Date(`${customStart}T00:00:00.000Z`); end = new Date(`${customEnd}T00:00:00.000Z`); label = `${customStart} to ${customEnd}`; }
  if (end < start || (end.getTime() - start.getTime()) / 86_400_000 > 731) throw new Error("INVALID_RANGE");
  return { start, end: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999)), label, period: selected };
}

const sum = (values: Prisma.Decimal[]) => values.reduce((total, value) => total.plus(value), zero);
const balance = (type: string, debit: Prisma.Decimal, credit: Prisma.Decimal) => ["ASSET", "EXPENSE"].includes(type) ? debit.minus(credit) : credit.minus(debit);
const journalWhere = (businessId: string, end: Date, start?: Date) => ({ businessId, journalEntry: { businessId, status: "POSTED" as const, entryDate: { ...(start ? { gte: start } : {}), lte: end } } });

async function aggregate(businessId: string, end: Date, start?: Date): Promise<Aggregate[]> {
  const result = await prisma.journalLine.groupBy({ by: ["ledgerAccountId"], where: journalWhere(businessId, end, start), _sum: { debitAmount: true, creditAmount: true }, _count: { _all: true } });
  return result.map((row) => ({ ledgerAccountId: row.ledgerAccountId, debit: row._sum.debitAmount ?? zero, credit: row._sum.creditAmount ?? zero, entryCount: row._count._all }));
}

function serialize(row: ReportAccount & Aggregate) { return { accountId: row.id, code: row.code, name: row.name, type: row.type, debit: row.debit.toFixed(2), credit: row.credit.toFixed(2), balance: balance(row.type, row.debit, row.credit).toFixed(2), entryCount: row.entryCount }; }

export async function getFinancialReports(businessId: string, raw: Record<string, string | string[] | undefined> = {}) {
  noStore(); const range = parseReportRange(raw);
  const [periodAggregate, toDateAggregate, cashBeforeAggregate] = await Promise.all([aggregate(businessId, range.end, range.start), aggregate(businessId, range.end), aggregate(businessId, new Date(range.start.getTime() - 1))]);
  const accountIds = [...new Set([...periodAggregate, ...toDateAggregate, ...cashBeforeAggregate].map((row) => row.ledgerAccountId))];
  const accounts = accountIds.length ? await prisma.ledgerAccount.findMany({ where: { businessId, id: { in: accountIds } }, select: { id: true, code: true, name: true, type: true, normalBalance: true } }) : [];
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const attach = (items: Aggregate[]) => items.flatMap((row) => { const account = accountsById.get(row.ledgerAccountId); return account ? [{ ...account, ...row }] : []; }).sort((a, b) => a.code.localeCompare(b.code));
  const period = attach(periodAggregate); const asOf = attach(toDateAggregate); const cashBefore = attach(cashBeforeAggregate);
  const income = period.filter((row) => row.type === "INCOME"); const expenses = period.filter((row) => row.type === "EXPENSE");
  const incomeTotal = sum(income.map((row) => row.credit.minus(row.debit))); const expenseTotal = sum(expenses.map((row) => row.debit.minus(row.credit)));
  const assets = asOf.filter((row) => row.type === "ASSET"); const liabilities = asOf.filter((row) => row.type === "LIABILITY"); const equity = asOf.filter((row) => row.type === "EQUITY");
  const assetTotal = sum(assets.map((row) => balance(row.type, row.debit, row.credit))); const liabilityTotal = sum(liabilities.map((row) => balance(row.type, row.debit, row.credit))); const equityTotal = sum(equity.map((row) => balance(row.type, row.debit, row.credit)));
  const netIncomeToDate = sum(asOf.filter((row) => row.type === "INCOME").map((row) => row.credit.minus(row.debit))).minus(sum(asOf.filter((row) => row.type === "EXPENSE").map((row) => row.debit.minus(row.credit)))); const totalEquity = equityTotal.plus(netIncomeToDate);
  const trialDebit = sum(asOf.map((row) => row.debit)); const trialCredit = sum(asOf.map((row) => row.credit));
  const isCash = (row: ReportAccount) => row.type === "ASSET" && (row.name.toLowerCase().includes("checking") || row.name.toLowerCase().includes("cash"));
  const cashRows = period.filter(isCash); const openingCash = sum(cashBefore.filter(isCash).map((row) => balance(row.type, row.debit, row.credit))); const cashInflows = sum(cashRows.map((row) => row.debit)); const cashOutflows = sum(cashRows.map((row) => row.credit)); const cashChange = cashInflows.minus(cashOutflows); const endingCash = openingCash.plus(cashChange);
  return { range: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label, period: range.period }, profitAndLoss: { income: income.map(serialize), expenses: expenses.map(serialize), totalIncome: incomeTotal.toFixed(2), totalExpenses: expenseTotal.toFixed(2), netIncome: incomeTotal.minus(expenseTotal).toFixed(2) }, balanceSheet: { assets: assets.map(serialize), liabilities: liabilities.map(serialize), equity: equity.map(serialize), totalAssets: assetTotal.toFixed(2), totalLiabilitiesAndEquity: liabilityTotal.plus(totalEquity).toFixed(2), difference: assetTotal.minus(liabilityTotal.plus(totalEquity)).toFixed(2) }, trialBalance: { rows: asOf.map(serialize), totalDebits: trialDebit.toFixed(2), totalCredits: trialCredit.toFixed(2), difference: trialDebit.minus(trialCredit).toFixed(2) }, cashActivity: { openingCash: openingCash.toFixed(2), inflows: cashInflows.toFixed(2), outflows: cashOutflows.toFixed(2), netChange: cashChange.toFixed(2), endingCash: endingCash.toFixed(2) } };
}

export async function getReportAccountDetail(businessId: string, accountId: string, kind: ReportKind, raw: Record<string, string | string[] | undefined> = {}) {
  noStore(); const range = parseReportRange(raw); const page = Math.max(1, Math.min(Number(raw.page) || 1, 100_000)); const start = kind === "profit-and-loss" || kind === "cash-activity" ? range.start : undefined;
  const account = await prisma.ledgerAccount.findFirst({ where: { id: accountId, businessId }, select: { id: true, code: true, name: true } }); if (!account) return null;
  const records = await prisma.journalLine.findMany({ where: { ...journalWhere(businessId, range.end, start), ledgerAccountId: account.id }, select: { id: true, debitAmount: true, creditAmount: true, journalEntry: { select: { id: true, transactionId: true, entryDate: true, description: true } } }, orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize + 1 });
  const hasNextPage = records.length > pageSize; const entries = records.slice(0, pageSize).map((record) => ({ id: record.id, journalEntryId: record.journalEntry.id, transactionId: record.journalEntry.transactionId, date: record.journalEntry.entryDate.toISOString(), description: record.journalEntry.description, debit: record.debitAmount.toFixed(2), credit: record.creditAmount.toFixed(2) }));
  return { account, range: { ...range, start: range.start.toISOString(), end: range.end.toISOString() }, page, pageSize, hasNextPage, entries };
}

export function csvCell(value: string) { const escaped = value.replaceAll('"', '""'); return /^\s*[=+\-@]/.test(escaped) ? `'${escaped}` : escaped; }
export function reportCsv(reports: Awaited<ReturnType<typeof getFinancialReports>>, kind: ReportKind) {
  const header = ["Report", "Period", "Account code", "Account name", "Debit", "Credit", "Balance"];
  const reportName = kind === "profit-and-loss" ? "Profit and Loss" : kind === "balance-sheet" ? "Balance Sheet" : kind === "trial-balance" ? "Trial Balance" : "Cash Activity";
  const rows = kind === "profit-and-loss" ? [...reports.profitAndLoss.income, ...reports.profitAndLoss.expenses].map((row) => [reportName, reports.range.label, row.code, row.name, row.debit, row.credit, row.balance]) : kind === "balance-sheet" ? [...reports.balanceSheet.assets, ...reports.balanceSheet.liabilities, ...reports.balanceSheet.equity].map((row) => [reportName, reports.range.label, row.code, row.name, row.debit, row.credit, row.balance]) : kind === "trial-balance" ? reports.trialBalance.rows.map((row) => [reportName, reports.range.label, row.code, row.name, row.debit, row.credit, row.balance]) : [[reportName, reports.range.label, "", "Opening cash", "", "", reports.cashActivity.openingCash], [reportName, reports.range.label, "", "Inflows", "", "", reports.cashActivity.inflows], [reportName, reports.range.label, "", "Outflows", "", "", reports.cashActivity.outflows], [reportName, reports.range.label, "", "Net change", "", "", reports.cashActivity.netChange], [reportName, reports.range.label, "", "Ending cash", "", "", reports.cashActivity.endingCash]];
  return [header, ...rows].map((row) => row.map((cell) => `"${csvCell(cell)}"`).join(",")).join("\r\n");
}
