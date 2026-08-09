import type { PrismaClient } from "../../generated/prisma/client";

export type YearEndCheck = { key: string; label: string; count: number; detail: string };
export type CpaReviewItem = { key: string; label: string; count: number; detail: string };

/** Deterministic year-end bookkeeping readiness. It deliberately does not make tax or legal conclusions. */
export async function getYearEndReadiness(client: PrismaClient, businessId: string, year: number) {
  const start = new Date(Date.UTC(year, 0, 1)); const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const [imports, transfers, reimbursements, payroll, assets, inServiceAssets, documents, reconciliations, closedMonths] = await Promise.all([
    client.externalTransaction.count({ where: { businessId, transactionDate: { gte: start, lte: end }, status: { notIn: ["POSTED", "IGNORED", "DUPLICATE", "INVALID"] } } }),
    client.ownerMoneyTransfer.count({ where: { businessId, status: "PENDING_REVIEW" } }),
    client.reimbursementClaim.count({ where: { businessId, status: { in: ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION", "APPROVED"] } } }),
    client.payrollBankMatch.count({ where: { businessId, payrollRun: { payDate: { gte: start, lte: end } }, status: { not: "MATCHED" } } }),
    client.fixedAsset.count({ where: { businessId, acquisitionDate: { gte: start, lte: end }, status: "POSSIBLE_REVIEW" } }),
    client.fixedAsset.count({ where: { businessId, acquisitionDate: { gte: start, lte: end }, status: "IN_SERVICE" } }),
    client.document.count({ where: { businessId, uploadedAt: { gte: start, lte: end }, status: { in: ["PENDING_VALIDATION", "QUARANTINED", "REJECTED"] } } }),
    client.reconciliation.count({ where: { businessId, statementEndDate: { gte: start, lte: end }, status: { not: "COMPLETED" } } }),
    client.monthEndClose.count({ where: { businessId, periodStart: { gte: start, lte: end }, status: "CLOSED" } }),
  ]);
  const today = new Date(); const requiredMonths = year < today.getUTCFullYear() ? 12 : Math.min(12, today.getUTCMonth());
  const checks: YearEndCheck[] = [
    { key: "month-closes", label: "Completed month-end closes", count: Math.max(0, requiredMonths - closedMonths), detail: "Close every completed month before CPA handoff." },
    { key: "imports", label: "Unresolved imported transactions", count: imports, detail: "Review, post, or explicitly ignore remaining imported activity." },
    { key: "owner-money", label: "Unresolved owner money", count: transfers + reimbursements, detail: "Resolve owner transfers and reimbursement lifecycle items." },
    { key: "payroll", label: "Payroll reconciliation exceptions", count: payroll, detail: "Match or document payroll bank-evidence differences." },
    { key: "assets", label: "Possible fixed assets", count: assets, detail: "Review capitalization and placed-in-service evidence; no depreciation is assumed." },
    { key: "documents", label: "Document security exceptions", count: documents, detail: "Resolve unavailable, rejected, or pending documents." },
    { key: "reconciliations", label: "Incomplete reconciliations", count: reconciliations, detail: "Complete all statement reconciliations in the reporting year." },
  ];
  const issues = checks.filter((check) => check.count > 0);
  const cpaReviewItems: CpaReviewItem[] = inServiceAssets ? [{ key: "fixed-asset-tax-treatment", label: "Fixed asset tax/depreciation treatment pending", count: inServiceAssets, detail: "In-service status records bookkeeping facts only. Confirm depreciation and tax treatment with the CPA; this does not block bookkeeping readiness." }] : [];
  return { year, status: issues.length ? "ISSUES_REMAIN" as const : "READY_FOR_CPA" as const, checks, issues, cpaReviewItems };
}
