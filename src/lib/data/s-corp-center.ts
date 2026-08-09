import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import { assessDistributionReadiness } from "../services/s-corp-intelligence";

const money = (value: Prisma.Decimal | null) => value?.toFixed(2) ?? null;

/** Read model for the Owner Money S-Corp workpaper center. Tax facts are never inferred from ledger equity. */
export async function getSCorpCenter(businessId: string, year = new Date().getUTCFullYear()) {
  const [workpaper, instruments, policies, benefit, snapshots, claims, readiness] = await Promise.all([
    prisma.shareholderBasisWorkpaper.findUnique({ where: { businessId_taxYear: { businessId, taxYear: year } }, include: { adjustments: { orderBy: { createdAt: "desc" } } } }),
    prisma.shareholderDebtInstrument.findMany({ where: { businessId }, orderBy: { loanDate: "desc" } }),
    prisma.accountingPolicy.findMany({ where: { businessId }, include: { currentVersion: true, versions: { orderBy: { effectiveDate: "desc" }, take: 5 } }, orderBy: { policyType: "asc" } }),
    prisma.shareholderBenefitWorkpaper.findFirst({ where: { businessId, taxYear: year, benefitType: "GREATER_THAN_2_PERCENT_HEALTH_INSURANCE" } }),
    prisma.distributionReadinessSnapshot.findMany({ where: { businessId }, include: { ownerDistribution: { select: { distributionDate: true, amount: true } } }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.reimbursementClaim.findMany({ where: { businessId, status: { not: "VOIDED" } }, select: { status: true, totalAmount: true, createdAt: true, expenses: { take: 1, select: { documentId: true, businessPurpose: true } } } }),
    assessDistributionReadiness(prisma, businessId, year),
  ]);
  const now = Date.now();
  const reimbursementStates = claims.reduce((result, claim) => {
    const ageDays = Math.floor((now - claim.createdAt.getTime()) / 86_400_000);
    const state = claim.status === "PAID" ? "COMPLETED" : claim.status === "APPROVED" ? "REIMBURSEMENT_DUE" : claim.status === "NEEDS_INFORMATION" || !claim.expenses[0]?.documentId || !claim.expenses[0]?.businessPurpose ? "NEEDS_DOCUMENTATION" : claim.status === "SUBMITTED" || claim.status === "DRAFT" ? "READY_FOR_REVIEW" : "EXCEPTION";
    result[state] = (result[state] ?? 0) + 1;
    if (ageDays > 30 && state !== "COMPLETED") result.aging += 1;
    return result;
  }, { aging: 0 } as Record<string, number>);
  return {
    year,
    basis: workpaper ? { id: workpaper.id, version: workpaper.version, effectiveDate: workpaper.effectiveDate?.toISOString().slice(0, 10) ?? "", openingStockBasis: money(workpaper.openingStockBasis), openingDebtBasis: money(workpaper.openingDebtBasis), sourceReference: workpaper.sourceReference, reviewedAt: workpaper.reviewedAt?.toISOString() ?? null, adjustments: workpaper.adjustments.map((item) => ({ id: item.id, category: item.category, amount: item.amount.toFixed(2), source: item.source, confirmedAt: item.confirmedAt?.toISOString() ?? null })) } : null,
    debtInstruments: instruments.map((item) => ({ id: item.id, label: item.label, loanDate: item.loanDate.toISOString().slice(0, 10), originalPrincipal: item.originalPrincipal.toFixed(2), outstandingPrincipal: item.outstandingPrincipal.toFixed(2), taxBasisAmount: money(item.taxBasisAmount), accountingReference: item.accountingReference, cpaNotes: item.cpaNotes })),
    readiness,
    policies: policies.map((item) => ({ id: item.id, version: item.version, policyType: item.policyType, title: item.title, effectiveDate: item.currentVersion?.effectiveDate.toISOString().slice(0, 10) ?? null, content: item.currentVersion?.content ?? null, versions: item.versions.map((version) => ({ id: version.id, effectiveDate: version.effectiveDate.toISOString().slice(0, 10), reason: version.reason })) })),
    benefit: benefit ? { provider: benefit.provider, premiumAmount: money(benefit.premiumAmount), payrollInclusionStatus: benefit.payrollInclusionStatus, w2WorkpaperStatus: benefit.w2WorkpaperStatus, cpaReviewStatus: benefit.cpaReviewStatus } : null,
    reimbursementStates,
    snapshots: snapshots.map((item) => ({ id: item.id, status: item.status, createdAt: item.createdAt.toISOString(), acknowledgedAt: item.acknowledgedAt?.toISOString() ?? null, distributionDate: item.ownerDistribution?.distributionDate.toISOString().slice(0, 10) ?? null, amount: money(item.ownerDistribution?.amount ?? null) })),
  };
}
