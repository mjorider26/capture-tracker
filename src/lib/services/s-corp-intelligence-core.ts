export type BasisStatus = "CURRENT" | "NEEDS_YEAR_END_INPUT" | "INCOMPLETE" | "CPA_REVIEW";
export type DistributionReadiness = "READY_FOR_OWNER_REVIEW" | "REVIEW_RECOMMENDED" | "BLOCKED_BY_BOOKKEEPING" | "CPA_REVIEW_RECOMMENDED";

export function basisStatus(input: { openingStockBasis: string | null; taxYear: number; reviewedAt: Date | null; hasUnresolvedItems: boolean; now?: Date }): BasisStatus {
  if (input.openingStockBasis === null) return "INCOMPLETE";
  if (input.hasUnresolvedItems) return "CPA_REVIEW";
  if (!input.reviewedAt || input.reviewedAt.getUTCFullYear() < input.taxYear) return "NEEDS_YEAR_END_INPUT";
  return "CURRENT";
}

/** Factual bookkeeping/workpaper status only. It never approves or characterizes a distribution for tax. */
export function distributionReadiness(input: { unreconciledAccounts: number; unresolvedActivity: number; payrollMismatch: boolean; basisStatus: BasisStatus; compensationReviewStale: boolean; reimbursementsDue: number }): DistributionReadiness {
  if (input.unreconciledAccounts > 0 || input.unresolvedActivity > 0 || input.payrollMismatch) return "BLOCKED_BY_BOOKKEEPING";
  if (input.basisStatus === "INCOMPLETE" || input.basisStatus === "CPA_REVIEW") return "CPA_REVIEW_RECOMMENDED";
  if (input.compensationReviewStale || input.reimbursementsDue > 0 || input.basisStatus === "NEEDS_YEAR_END_INPUT") return "REVIEW_RECOMMENDED";
  return "READY_FOR_OWNER_REVIEW";
}

/** Uses an evidenced candidate date and the earliest unresolved item on or before it. Future facts cannot regress historic completion. */
export function booksCurrentThrough(candidateThrough: Date | null, blockers: readonly Date[]): Date | null {
  if (!candidateThrough) return null;
  const candidate = new Date(Date.UTC(candidateThrough.getUTCFullYear(), candidateThrough.getUTCMonth(), candidateThrough.getUTCDate()));
  const first = blockers.map((date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))).filter((date) => date <= candidate).sort((a, b) => a.getTime() - b.getTime())[0];
  if (!first) return candidate;
  const dayBefore = new Date(first); dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return dayBefore;
}
