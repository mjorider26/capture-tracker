import { Prisma, type BusinessRole, type PrismaClient } from "../../generated/prisma/client";
import { z } from "zod";

import { basisStatus, distributionReadiness, type BasisStatus, type DistributionReadiness } from "./s-corp-intelligence-core";

type Db = PrismaClient | Prisma.TransactionClient;
export type SCorpActor = { businessId: string; actorUserId: string; actorMembershipId: string; role: BusinessRole; executionMode: "authenticated" | "demo" };

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00.000Z`));
const amount = z.string().trim().regex(/^-?\d{1,15}(?:\.\d{1,2})?$/, "Enter a valid amount.").transform((value) => new Prisma.Decimal(value).toFixed(2));
const optionalAmount = z.union([amount, z.literal(""), z.null(), z.undefined()]).transform((value) => typeof value === "string" && value ? value : null);
const reference = z.string().trim().max(500).optional().transform((value) => value || null);
const notes = z.string().trim().max(4_000).optional().transform((value) => value || null);
const year = z.coerce.number().int().min(2000).max(2200);

const assertOwner = (actor: SCorpActor) => actor.role === "OWNER";
const audit = (actor: SCorpActor, entityType: string, entityId: string, action: "CREATE" | "UPDATE", afterJson: Prisma.InputJsonValue) => ({
  actorType: "USER" as const, businessId: actor.businessId, actorMembershipId: actor.actorMembershipId, action, entityType, entityId, afterJson,
  metadataJson: { executionMode: actor.executionMode, sCorpWorkpaper: true },
});

export const basisOpeningSchema = z.object({
  taxYear: year,
  effectiveDate: z.union([date, z.literal(""), z.undefined()]).transform((value) => value || null),
  openingStockBasis: optionalAmount,
  openingDebtBasis: optionalAmount,
  sourceReference: reference,
  notes,
  ownerConfirmation: z.literal("on"),
  version: z.coerce.number().int().positive().optional(),
}).superRefine((input, context) => {
  if ((input.openingStockBasis !== null || input.openingDebtBasis !== null) && !input.sourceReference) context.addIssue({ code: "custom", path: ["sourceReference"], message: "A source or reference is required for a known opening amount." });
});

/** Records declared workpaper facts; null is intentionally preserved as unknown rather than converted to zero. */
export async function saveBasisOpening(client: Db, actor: SCorpActor, raw: unknown) {
  if (!assertOwner(actor)) return { ok: false as const, message: "Only the business owner can confirm an opening basis workpaper." };
  const parsed = basisOpeningSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "The opening basis workpaper is invalid." };
  const input = parsed.data;
  return client.$transaction(async (tx) => {
    const existing = await tx.shareholderBasisWorkpaper.findUnique({ where: { businessId_taxYear: { businessId: actor.businessId, taxYear: input.taxYear } }, select: { id: true, version: true } });
    if (existing && input.version !== existing.version) return { ok: false as const, message: "This basis workpaper changed. Refresh before confirming it." };
    const values = { effectiveDate: input.effectiveDate, openingStockBasis: input.openingStockBasis, openingDebtBasis: input.openingDebtBasis, sourceReference: input.sourceReference, notes: input.notes, enteredByUserId: actor.actorUserId, ownerConfirmedByUserId: actor.actorUserId, ownerConfirmedAt: new Date() };
    const workpaper = existing
      ? await tx.shareholderBasisWorkpaper.update({ where: { id: existing.id }, data: { ...values, version: { increment: 1 } } })
      : await tx.shareholderBasisWorkpaper.create({ data: { businessId: actor.businessId, taxYear: input.taxYear, ...values } });
    await tx.auditEvent.create({ data: audit(actor, "ShareholderBasisWorkpaper", workpaper.id, existing ? "UPDATE" : "CREATE", { taxYear: input.taxYear, openingStockBasisKnown: input.openingStockBasis !== null, openingDebtBasisKnown: input.openingDebtBasis !== null, ownerConfirmed: true }) });
    return { ok: true as const, id: workpaper.id };
  });
}

const adjustmentCategories = ["CONTRIBUTION", "DISTRIBUTION", "SEPARATELY_STATED_INCOME", "SEPARATELY_STATED_DEDUCTION", "LOSS_LIMITATION", "CPA_WORKPAPER_CORRECTION"] as const;
export const basisAdjustmentSchema = z.object({ taxYear: year, category: z.enum(adjustmentCategories), amount, source: z.string().trim().min(3).max(500), documentReference: reference, notes, workpaperId: id, confirmation: z.literal("on") });
export async function createBasisAdjustment(client: Db, actor: SCorpActor, raw: unknown) {
  if (!assertOwner(actor)) return { ok: false as const, message: "Only the business owner can record a basis workpaper adjustment." };
  const parsed = basisAdjustmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "The basis workpaper adjustment is invalid." };
  const input = parsed.data;
  return client.$transaction(async (tx) => {
    const workpaper = await tx.shareholderBasisWorkpaper.findFirst({ where: { id: input.workpaperId, businessId: actor.businessId, taxYear: input.taxYear }, select: { id: true } });
    if (!workpaper) return { ok: false as const, message: "Choose a basis workpaper belonging to this business and tax year." };
    const adjustment = await tx.shareholderBasisAdjustment.create({ data: { businessId: actor.businessId, workpaperId: workpaper.id, taxYear: input.taxYear, category: input.category, amount: input.amount, source: input.source, documentReference: input.documentReference, notes: input.notes, confirmedByUserId: actor.actorUserId, confirmedAt: new Date() } });
    await tx.auditEvent.create({ data: audit(actor, "ShareholderBasisAdjustment", adjustment.id, "CREATE", { taxYear: input.taxYear, category: input.category, amount: input.amount, source: input.source }) });
    return { ok: true as const, id: adjustment.id };
  });
}

export const debtInstrumentSchema = z.object({ loanDate: date, label: z.string().trim().min(3).max(180), originalPrincipal: amount, outstandingPrincipal: amount, taxBasisAmount: optionalAmount, writtenNoteReference: reference, accountingReference: reference, cpaNotes: notes });
export async function createDebtInstrument(client: Db, actor: SCorpActor, raw: unknown) {
  if (!assertOwner(actor)) return { ok: false as const, message: "Only the business owner can add a shareholder debt instrument." };
  const parsed = debtInstrumentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "The shareholder debt instrument is invalid." };
  const input = parsed.data;
  return client.$transaction(async (tx) => {
    const instrument = await tx.shareholderDebtInstrument.create({ data: { businessId: actor.businessId, ...input } });
    await tx.auditEvent.create({ data: audit(actor, "ShareholderDebtInstrument", instrument.id, "CREATE", { label: input.label, originalPrincipal: input.originalPrincipal, taxBasisKnown: input.taxBasisAmount !== null, accountingReference: input.accountingReference }) });
    return { ok: true as const, id: instrument.id };
  });
}

export const policyTypes = ["RECEIPT_DOCUMENT", "MERCHANT_CATEGORY", "CAPITALIZATION", "ACCOUNTABLE_PLAN", "PAYROLL_CLEARING", "COMPENSATION_WORKPAPER", "CASH_TAX_RESERVE", "BOOKKEEPING_CUTOVER"] as const;
export const policySchema = z.object({ policyType: z.enum(policyTypes), title: z.string().trim().min(3).max(180), effectiveDate: date, content: z.string().trim().min(3).max(8_000), reason: notes, version: z.coerce.number().int().positive().optional() });
export async function saveAccountingPolicy(client: Db, actor: SCorpActor, raw: unknown) {
  if (!assertOwner(actor)) return { ok: false as const, message: "Only the business owner can change an accounting policy." };
  const parsed = policySchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "The accounting policy is invalid." };
  const input = parsed.data;
  return client.$transaction(async (tx) => {
    const existing = await tx.accountingPolicy.findUnique({ where: { businessId_policyType: { businessId: actor.businessId, policyType: input.policyType } }, select: { id: true, version: true } });
    if (existing && input.version !== existing.version) return { ok: false as const, message: "This policy changed. Refresh before saving a new version." };
    if (!existing) {
      const policy = await tx.accountingPolicy.create({ data: { businessId: actor.businessId, policyType: input.policyType, title: input.title } });
      const version = await tx.accountingPolicyVersion.create({ data: { businessId: actor.businessId, policyId: policy.id, effectiveDate: input.effectiveDate, content: input.content, reason: input.reason, changedByUserId: actor.actorUserId } });
      await tx.accountingPolicy.update({ where: { id: policy.id }, data: { currentVersionId: version.id } });
      await tx.auditEvent.create({ data: audit(actor, "AccountingPolicy", policy.id, "CREATE", { policyType: input.policyType, policyVersionId: version.id, effectiveDate: input.effectiveDate.toISOString() }) });
      return { ok: true as const, id: policy.id };
    }
    const gate = await tx.accountingPolicy.updateMany({ where: { id: existing.id, businessId: actor.businessId, version: existing.version }, data: { title: input.title, version: { increment: 1 } } });
    if (gate.count !== 1) return { ok: false as const, message: "This policy changed. Refresh before saving a new version." };
    const version = await tx.accountingPolicyVersion.create({ data: { businessId: actor.businessId, policyId: existing.id, effectiveDate: input.effectiveDate, content: input.content, reason: input.reason, changedByUserId: actor.actorUserId } });
    await tx.accountingPolicy.update({ where: { id: existing.id }, data: { currentVersionId: version.id } });
    await tx.auditEvent.create({ data: audit(actor, "AccountingPolicy", existing.id, "UPDATE", { policyType: input.policyType, policyVersionId: version.id, effectiveDate: input.effectiveDate.toISOString() }) });
    return { ok: true as const, id: existing.id };
  });
}

export const healthInsuranceSchema = z.object({ taxYear: year, provider: z.string().trim().max(180).optional().transform((value) => value || null), coverageStart: z.union([date, z.literal(""), z.undefined()]).transform((value) => value || null), coverageEnd: z.union([date, z.literal(""), z.undefined()]).transform((value) => value || null), premiumAmount: optionalAmount, paymentMethod: z.string().trim().max(64).optional().transform((value) => value || null), payrollInclusionStatus: z.enum(["INCOMPLETE", "COMPLETE", "REVIEW_NEEDED"]), w2WorkpaperStatus: z.enum(["INCOMPLETE", "READY", "REVIEW_NEEDED"]), documentReference: reference, cpaReviewStatus: z.enum(["CPA_REVIEW", "COMPLETE"]), notes });
export async function saveHealthInsuranceWorkpaper(client: Db, actor: SCorpActor, raw: unknown) {
  if (!assertOwner(actor)) return { ok: false as const, message: "Only the business owner can update shareholder benefit workpapers." };
  const parsed = healthInsuranceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "The health-insurance workpaper is invalid." };
  const input = parsed.data;
  return client.$transaction(async (tx) => {
    const existing = await tx.shareholderBenefitWorkpaper.findFirst({ where: { businessId: actor.businessId, taxYear: input.taxYear, benefitType: "GREATER_THAN_2_PERCENT_HEALTH_INSURANCE" }, select: { id: true } });
    const record = existing ? await tx.shareholderBenefitWorkpaper.update({ where: { id: existing.id }, data: { ...input, version: { increment: 1 } } }) : await tx.shareholderBenefitWorkpaper.create({ data: { businessId: actor.businessId, benefitType: "GREATER_THAN_2_PERCENT_HEALTH_INSURANCE", ...input } });
    await tx.auditEvent.create({ data: audit(actor, "ShareholderBenefitWorkpaper", record.id, existing ? "UPDATE" : "CREATE", { taxYear: input.taxYear, type: "GREATER_THAN_2_PERCENT_HEALTH_INSURANCE", premiumKnown: input.premiumAmount !== null, payrollInclusionStatus: input.payrollInclusionStatus, w2WorkpaperStatus: input.w2WorkpaperStatus }) });
    return { ok: true as const, id: record.id };
  });
}

export type DistributionReadinessAssessment = { status: DistributionReadiness; warnings: string[]; basis: { stock: BasisStatus; debt: "CURRENT" | "INCOMPLETE" | "CPA_REVIEW" }; facts: Record<string, number | string | boolean | null> };
/** Deterministic evidence checks. The result is an operational review state, never tax approval or a safe distribution amount. */
export async function assessDistributionReadiness(client: Db, businessId: string, taxYear: number): Promise<DistributionReadinessAssessment> {
  const through = new Date(Date.UTC(taxYear, 11, 31, 23, 59, 59, 999));
  const [workpaper, unresolvedActivity, duplicates, pendingTransfers, openReimbursements, payrollMismatch, accounts, reconciled, debtInstruments, benefit] = await Promise.all([
    client.shareholderBasisWorkpaper.findUnique({ where: { businessId_taxYear: { businessId, taxYear } }, include: { adjustments: { select: { confirmedAt: true } } } }),
    client.externalTransaction.count({ where: { businessId, transactionDate: { lte: through }, status: { in: ["IMPORTED", "NORMALIZED", "NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } } }),
    client.externalTransaction.count({ where: { businessId, transactionDate: { lte: through }, status: "POSSIBLE_DUPLICATE" } }),
    client.ownerMoneyTransfer.count({ where: { businessId, status: "PENDING_REVIEW" } }),
    client.reimbursementClaim.count({ where: { businessId, status: { in: ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION", "APPROVED"] } } }),
    client.payrollBankMatch.count({ where: { businessId, payrollRun: { payDate: { lte: through } }, status: { not: "MATCHED" } } }),
    client.financialAccount.findMany({ where: { businessId, ownership: "BUSINESS", isActive: true }, select: { id: true } }),
    client.reconciliation.findMany({ where: { businessId, statementEndDate: { lte: through }, status: "COMPLETED" }, select: { financialAccountId: true }, distinct: ["financialAccountId"] }),
    client.shareholderDebtInstrument.findMany({ where: { businessId }, select: { taxBasisAmount: true } }),
    client.shareholderBenefitWorkpaper.findFirst({ where: { businessId, taxYear, benefitType: "GREATER_THAN_2_PERCENT_HEALTH_INSURANCE" }, select: { payrollInclusionStatus: true, w2WorkpaperStatus: true } }),
  ]);
  const stock = basisStatus({ openingStockBasis: workpaper?.openingStockBasis?.toFixed(2) ?? null, taxYear, reviewedAt: workpaper?.reviewedAt ?? null, hasUnresolvedItems: Boolean(workpaper?.adjustments.some((item) => !item.confirmedAt)) });
  const debt = workpaper?.openingDebtBasis === null && debtInstruments.some((item) => item.taxBasisAmount === null) ? "INCOMPLETE" : debtInstruments.some((item) => item.taxBasisAmount === null) ? "CPA_REVIEW" : "CURRENT";
  const unreconciledAccounts = accounts.filter((account) => !reconciled.some((item) => item.financialAccountId === account.id)).length;
  const unresolved = unresolvedActivity + duplicates + pendingTransfers;
  const compensationReviewStale = payrollMismatch > 0 || benefit?.payrollInclusionStatus === "REVIEW_NEEDED" || benefit?.w2WorkpaperStatus === "REVIEW_NEEDED";
  const status = distributionReadiness({ unreconciledAccounts, unresolvedActivity: unresolved, payrollMismatch: payrollMismatch > 0, basisStatus: stock === "CURRENT" && debt === "CURRENT" ? "CURRENT" : stock, compensationReviewStale, reimbursementsDue: openReimbursements });
  const warnings = [
    ...(unreconciledAccounts ? [`${unreconciledAccounts} business account reconciliation(s) need attention.`] : []),
    ...(unresolved ? [`${unresolved} imported, duplicate, or owner-transfer item(s) remain unresolved.`] : []),
    ...(payrollMismatch ? [`${payrollMismatch} payroll reconciliation item(s) remain unmatched.`] : []),
    ...(stock === "INCOMPLETE" ? ["Stock basis workpaper is incomplete."] : []),
    ...(debt === "INCOMPLETE" ? ["Debt basis workpaper is incomplete."] : []),
    ...(openReimbursements ? [`${openReimbursements} reimbursement item(s) remain open.`] : []),
  ];
  return { status, warnings, basis: { stock, debt }, facts: { unreconciledAccounts, unresolvedActivity, duplicates, pendingTransfers, openReimbursements, payrollMismatch, compensationReviewStale, healthInsuranceWorkpaper: benefit ? "CONFIGURED" : "NOT_CONFIGURED" } };
}

/** Persists an immutable point-in-time operational review snapshot alongside a recorded distribution. */
export async function captureDistributionReadinessSnapshot(client: Db, actor: SCorpActor, ownerDistributionId: string, taxYear: number, acknowledged: boolean) {
  const distribution = await client.ownerDistribution.findFirst({ where: { id: ownerDistributionId, businessId: actor.businessId }, select: { id: true, distributionDate: true, amount: true, sourceAccountId: true } });
  if (!distribution) return { ok: false as const, message: "The recorded distribution is unavailable." };
  const assessment = await assessDistributionReadiness(client, actor.businessId, taxYear);
  const snapshot = await client.distributionReadinessSnapshot.create({ data: { businessId: actor.businessId, ownerDistributionId: distribution.id, status: assessment.status, snapshotJson: { distribution: { date: distribution.distributionDate.toISOString(), amount: distribution.amount.toFixed(2), sourceAccountId: distribution.sourceAccountId }, readiness: assessment, acknowledged }, acknowledgedAt: acknowledged ? new Date() : null } });
  await client.auditEvent.create({ data: audit(actor, "DistributionReadinessSnapshot", snapshot.id, "CREATE", { ownerDistributionId: distribution.id, status: assessment.status, acknowledged }) });
  return { ok: true as const, id: snapshot.id, assessment };
}
