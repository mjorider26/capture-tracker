import { NextRequest } from "next/server";
import { csvCell, getFinancialReports, parseReportRange, reportCsv } from "@/lib/data/reports";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";
import { createPdfIndex, createZip, type ExportFile } from "@/lib/services/cpa-export-core";

const csv = (header: string[], rows: Array<Array<string | number | null>>) => [header, ...rows].map((row) => row.map((cell) => `"${csvCell(String(cell ?? ""))}"`).join(",")).join("\r\n");
const date = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : "";
const money = (value: { toFixed: (digits: number) => string } | null | undefined) => value?.toFixed(2) ?? "0.00";

/** Owner-only protected CPA handoff. The package includes evidence references, never private R2 bytes or URLs. */
export async function GET(request: NextRequest) {
  try {
    const context = await requireBusinessContext();
    if (context.membership.role !== "OWNER") return new Response("Export unavailable.", { status: 403, headers: { "Cache-Control": "no-store" } });
    const params = Object.fromEntries(request.nextUrl.searchParams); const range = parseReportRange(params); const reports = await getFinancialReports(context.business.id, params);
    const scoped = { businessId: context.business.id };
    const [journals, payroll, transfers, reimbursements, assets, taxes, reconciliations, documents, external, basis, adjustments, debt, snapshots, policies, benefits] = await Promise.all([
      prisma.journalEntry.findMany({ where: { ...scoped, status: "POSTED", entryDate: { gte: range.start, lte: range.end } }, include: { lines: { include: { ledgerAccount: { select: { code: true, name: true } } }, orderBy: { lineNumber: "asc" } } }, orderBy: [{ entryDate: "asc" }, { entryNumber: "asc" }] }),
      prisma.payrollRun.findMany({ where: { ...scoped, payDate: { gte: range.start, lte: range.end } }, orderBy: { payDate: "asc" } }),
      prisma.ownerMoneyTransfer.findMany({ where: scoped, include: { externalTransaction: { select: { transactionDate: true, description: true, amount: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.reimbursementClaim.findMany({ where: scoped, include: { expenses: true }, orderBy: { createdAt: "asc" } }),
      prisma.fixedAsset.findMany({ where: scoped, orderBy: { acquisitionDate: "asc" } }),
      prisma.taxPaymentRecord.findMany({ where: { ...scoped, paidAt: { gte: range.start, lte: range.end } }, orderBy: { paidAt: "asc" } }),
      prisma.reconciliation.findMany({ where: { ...scoped, statementEndDate: { gte: range.start, lte: range.end } }, orderBy: { statementEndDate: "asc" } }),
      prisma.document.findMany({ where: scoped, select: { originalFilename: true, status: true, malwareScanStatus: true, createdAt: true } }),
      prisma.externalTransaction.findMany({ where: { ...scoped, status: { not: "POSTED" }, transactionDate: { gte: range.start, lte: range.end } }, select: { transactionDate: true, description: true, amount: true, status: true, direction: true } }),
      prisma.shareholderBasisWorkpaper.findMany({ where: { ...scoped, taxYear: { gte: range.start.getUTCFullYear(), lte: range.end.getUTCFullYear() } }, orderBy: { taxYear: "asc" } }),
      prisma.shareholderBasisAdjustment.findMany({ where: { ...scoped, taxYear: { gte: range.start.getUTCFullYear(), lte: range.end.getUTCFullYear() } }, orderBy: { createdAt: "asc" } }),
      prisma.shareholderDebtInstrument.findMany({ where: scoped, orderBy: { loanDate: "asc" } }),
      prisma.distributionReadinessSnapshot.findMany({ where: scoped, include: { ownerDistribution: { select: { distributionDate: true, amount: true, sourceAccountId: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.accountingPolicy.findMany({ where: scoped, include: { currentVersion: true, versions: { orderBy: { effectiveDate: "asc" } } }, orderBy: { policyType: "asc" } }),
      prisma.shareholderBenefitWorkpaper.findMany({ where: { ...scoped, taxYear: { gte: range.start.getUTCFullYear(), lte: range.end.getUTCFullYear() } }, orderBy: { taxYear: "asc" } }),
    ]);
    const files: ExportFile[] = [
      { name: "profit-and-loss.csv", content: reportCsv(reports, "profit-and-loss") }, { name: "balance-sheet.csv", content: reportCsv(reports, "balance-sheet") }, { name: "trial-balance.csv", content: reportCsv(reports, "trial-balance") }, { name: "cash-activity.csv", content: reportCsv(reports, "cash-activity") },
      { name: "general-ledger.csv", content: csv(["Date", "Entry", "Description", "Account code", "Account", "Debit", "Credit"], journals.flatMap((entry) => entry.lines.map((line) => [date(entry.entryDate), entry.entryNumber, entry.description, line.ledgerAccount.code, line.ledgerAccount.name, money(line.debitAmount), money(line.creditAmount)]))) },
      { name: "payroll-summary.csv", content: csv(["Pay date", "Status", "Gross wages", "Net pay", "Payroll liabilities", "Provider fee", "Provider reference"], payroll.map((run) => [date(run.payDate), run.status, money(run.grossWages), money(run.netPay), money(run.employeeWithholding.plus(run.employeePayrollTax).plus(run.otherDeductions).plus(run.employerPayrollTax)), money(run.providerFee), run.externalReference])) },
      { name: "owner-money.csv", content: csv(["Kind", "Date", "Direction", "Treatment", "Status", "Amount", "Description"], [...transfers.map((item) => ["Transfer", date(item.externalTransaction.transactionDate), item.direction, item.classification, item.status, money(item.externalTransaction.amount), item.externalTransaction.description]), ...reimbursements.map((item) => ["Reimbursement", date(item.createdAt), "PERSONALLY_PAID", "REIMBURSEMENT", item.status, money(item.totalAmount), item.expenses[0]?.businessPurpose ?? ""])]) },
      { name: "fixed-assets.csv", content: csv(["Asset", "Category", "Vendor", "Acquisition date", "Cost", "Placed in service", "In-service approved", "Status", "CPA tax-treatment item", "CPA notes"], assets.map((item) => [item.name, item.category, item.vendor, date(item.acquisitionDate), money(item.acquisitionCost), date(item.placedInServiceDate), date(item.approvedAt), item.status, item.status === "IN_SERVICE" ? "PENDING CPA REVIEW" : "", item.cpaNotes])) },
      { name: "estimated-tax-payments.csv", content: csv(["Payment date", "Jurisdiction", "Tax year", "Quarter", "Amount", "Status", "Confirmation"], taxes.map((item) => [date(item.paidAt), `${item.jurisdictionType}:${item.jurisdictionCode}`, item.taxYear, item.quarter, money(item.amount), item.status, item.confirmationNumber])) },
      { name: "reconciliation-summary.csv", content: csv(["Statement end", "Status", "Opening balance", "Ending balance"], reconciliations.map((item) => [date(item.statementEndDate), item.status, money(item.statementOpeningBalance), money(item.statementEndingBalance)])) },
      { name: "unresolved-exceptions.csv", content: csv(["Date", "Direction", "Status", "Amount", "Description"], external.map((item) => [date(item.transactionDate), item.direction, item.status, money(item.amount), item.description])) },
      { name: "supporting-document-index.csv", content: csv(["Document name", "Document status", "Security scan status", "Recorded date"], documents.map((item) => [item.originalFilename, item.status, item.malwareScanStatus, date(item.createdAt)])) },
      { name: "stock-basis-workpaper.csv", content: csv(["Tax year", "Effective date", "Opening stock basis", "Opening debt basis", "Source/reference", "Owner confirmed", "CPA reviewed"], basis.map((item) => [item.taxYear, date(item.effectiveDate), money(item.openingStockBasis), money(item.openingDebtBasis), item.sourceReference, date(item.ownerConfirmedAt), date(item.reviewedAt)])) },
      { name: "basis-workpaper-adjustments.csv", content: csv(["Tax year", "Category", "Amount", "Source", "Reference", "Confirmed at"], adjustments.map((item) => [item.taxYear, item.category, money(item.amount), item.source, item.documentReference, date(item.confirmedAt)])) },
      { name: "shareholder-debt-basis-workpaper.csv", content: csv(["Loan date", "Instrument", "Original principal", "Outstanding principal", "Tax debt basis", "Book-loan reference", "Note reference", "CPA notes"], debt.map((item) => [date(item.loanDate), item.label, money(item.originalPrincipal), money(item.outstandingPrincipal), money(item.taxBasisAmount), item.accountingReference, item.writtenNoteReference, item.cpaNotes])) },
      { name: "distribution-readiness-snapshots.csv", content: csv(["Distribution date", "Amount", "Source account", "Readiness classification", "Owner acknowledgement", "Snapshot recorded"], snapshots.map((item) => [date(item.ownerDistribution?.distributionDate), money(item.ownerDistribution?.amount), item.ownerDistribution?.sourceAccountId ?? null, item.status, date(item.acknowledgedAt), date(item.createdAt)])) },
      { name: "accounting-policy-versions.csv", content: csv(["Policy", "Title", "Effective date", "Reason", "Current"], policies.flatMap((policy) => policy.versions.map((version) => [policy.policyType, policy.title, date(version.effectiveDate), version.reason, policy.currentVersionId === version.id ? "YES" : ""]))) },
      { name: "shareholder-benefit-workpaper.csv", content: csv(["Tax year", "Benefit", "Provider", "Coverage start", "Coverage end", "Premium", "Payroll inclusion", "W-2 workpaper", "CPA review", "Document reference"], benefits.map((item) => [item.taxYear, item.benefitType, item.provider, date(item.coverageStart), date(item.coverageEnd), money(item.premiumAmount), item.payrollInclusionStatus, item.w2WorkpaperStatus, item.cpaReviewStatus, item.documentReference])) },
    ];
    files.unshift({ name: "CPA_PACKAGE_INDEX.pdf", content: createPdfIndex("Capture Tracker CPA package", [
      `Reporting period: ${reports.range.label}`, `Generated: ${new Date().toISOString()}`, "Accounting basis: ledger-backed posted journals.", "Included: P&L, Balance Sheet, Trial Balance, cash activity, general ledger, payroll, owner money, S-Corp workpapers, assets, tax, reconciliations, exceptions, and evidence index.", "S-Corp schedules organize factual evidence and CPA-review items; they do not prepare a tax return or provide tax advice.", "Receipt bytes, private storage URLs, credentials, and infrastructure metadata are not included.", ...files.map((file) => `Schedule: ${file.name}`),
    ]) });
    return new Response(createZip(files), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="capture-tracker-cpa-package-${reports.range.start.slice(0, 10)}-to-${reports.range.end.slice(0, 10)}.zip"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Export unavailable.", { status: 403, headers: { "Cache-Control": "no-store" } }); }
}
