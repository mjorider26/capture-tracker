import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Actor = { businessId: string; actorUserId: string; membershipId: string };
const clean = (value: FormDataEntryValue | null, max: number) => typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, max) : "";
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : null;
const amount = (value: string) => /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value) ? new Prisma.Decimal(value) : null;
const periodBounds = (value: Date) => ({ startsAt: new Date(Date.UTC(value.getUTCFullYear(), 0, 1)), endsAt: new Date(Date.UTC(value.getUTCFullYear(), 11, 31, 23, 59, 59, 999)) });

export type CutoverState = { ok: boolean; message: string };

/** Records only owner/CPA-approved source facts and a balanced opening journal. */
export async function saveClientCutover(actor: Actor, form: FormData): Promise<CutoverState> {
  const ownerDisplayName = clean(form.get("ownerDisplayName"), 120); const displayName = clean(form.get("displayName"), 160); const legalName = clean(form.get("legalName"), 160); const timezone = clean(form.get("timezone"), 64); const fiscal = Number(form.get("fiscalYearStartMonth")); const cutoverDate = date(clean(form.get("cutoverDate"), 10)); const sourceReference = clean(form.get("sourceReference"), 300); const accountName = clean(form.get("accountName"), 120); const institutionName = clean(form.get("institutionName"), 120) || null; const lastFour = clean(form.get("lastFour"), 4) || null; const accountType = clean(form.get("accountType"), 24); const bankFeedMethod = clean(form.get("bankFeedMethod"), 12); const openingBalance = amount(clean(form.get("openingBalance"), 19));
  if (!ownerDisplayName || !displayName || !legalName || !cutoverDate || !sourceReference || !accountName || !openingBalance || !["CHECKING", "CREDIT_CARD"].includes(accountType) || !["MANUAL", "PLAID"].includes(bankFeedMethod) || !/^America\/[A-Za-z_]+$/.test(timezone) || !Number.isInteger(fiscal) || fiscal < 1 || fiscal > 12 || form.get("ownerConfirmed") !== "on") return { ok: false, message: "Enter approved source facts, a valid cutover date, an activity method, and owner confirmation." };
  try {
    await prisma.$transaction(async (tx) => {
      const onboarding = await tx.businessOnboarding.findUnique({ where: { businessId: actor.businessId } });
      const cutover = await tx.businessCutover.findUnique({ where: { businessId: actor.businessId } });
      if (!onboarding || !cutover || cutover.openingJournalId || onboarding.openingBalancesPosted) throw new Error("CUTOVER_ALREADY_RECORDED");
      const account = await tx.financialAccount.findFirst({ where: { businessId: actor.businessId, id: `workspace-${actor.businessId}-checking` } });
      const ledger = await tx.ledgerAccount.findUnique({ where: { businessId_code: { businessId: actor.businessId, code: "1000" } } });
      if (!account || !ledger) throw new Error("FOUNDATION_MISSING");
      const isCard = accountType === "CREDIT_CARD";
      await tx.business.update({ where: { id: actor.businessId }, data: { legalName, displayName, timezone, fiscalYearStartMonth: fiscal, taxElection: "S_CORP" } });
      await tx.financialAccount.update({ where: { id: account.id }, data: { name: accountName, institutionName, lastFour, type: accountType as "CHECKING" | "CREDIT_CARD", ownership: "BUSINESS", bankFeedMethod: bankFeedMethod as "MANUAL" | "PLAID", openingBalance, openedAt: cutoverDate } });
      await tx.ledgerAccount.update({ where: { id: ledger.id }, data: isCard ? { name: accountName, type: "LIABILITY", subtype: "CREDIT_CARD", normalBalance: "CREDIT" } : { name: accountName, type: "ASSET", subtype: "BANK", normalBalance: "DEBIT" } });
      const positive = openingBalance.abs();
      let openingJournalId: string | null = null;
      if (!positive.equals(0)) {
        const bounds = periodBounds(cutoverDate);
        const period = await tx.accountingPeriod.upsert({ where: { businessId_startsAt_endsAt: { businessId: actor.businessId, ...bounds } }, create: { businessId: actor.businessId, startsAt: bounds.startsAt, endsAt: bounds.endsAt, status: "OPEN" }, update: {} });
        const retained = await tx.ledgerAccount.findUnique({ where: { businessId_code: { businessId: actor.businessId, code: "3200" } } });
        if (!retained) throw new Error("FOUNDATION_MISSING");
        const entry = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `OPENING-${cutoverDate.getUTCFullYear()}`, entryDate: cutoverDate, description: "Approved opening balance cutover", status: "POSTED", sourceType: "OPENING_BALANCE", sourceEntityId: cutover.id, postedAt: new Date(), approvedByMembershipId: actor.actorUserId } });
        openingJournalId = entry.id;
        const debitLedger = isCard ? retained : ledger; const creditLedger = isCard ? ledger : retained;
        await tx.journalLine.createMany({ data: [{ businessId: actor.businessId, journalEntryId: entry.id, ledgerAccountId: debitLedger.id, lineNumber: 1, debitAmount: positive, creditAmount: new Prisma.Decimal(0), memo: sourceReference }, { businessId: actor.businessId, journalEntryId: entry.id, ledgerAccountId: creditLedger.id, lineNumber: 2, debitAmount: new Prisma.Decimal(0), creditAmount: positive, memo: sourceReference }] });
      }
      const ownerMoneyInitialized = form.get("ownerMoneyInitialized") === "on"; const payrollYtdEstablished = form.get("payrollYtdEstablished") === "on"; const fixedAssetsReviewed = form.get("fixedAssetsReviewed") === "on";
      await tx.businessCutover.update({ where: { businessId: actor.businessId }, data: { startDate: cutoverDate, sourceReference, openingJournalId, version: { increment: 1 } } });
      await tx.businessOnboarding.update({ where: { businessId: actor.businessId }, data: { actorUserId: actor.actorUserId, ownerDisplayName, cutoverDate, openingBalancesPosted: true, ownerMoneyInitialized, payrollYtdEstablished, fixedAssetsReviewed, accountSetupCompleted: true, preferredBankFeedMethod: bankFeedMethod as "MANUAL" | "PLAID", ownerMoneyContext: ownerMoneyInitialized ? "REVIEWED" : "NEEDS_REVIEW", payrollContext: payrollYtdEstablished ? "REVIEWED" : "NEEDS_REVIEW", fixedAssetsContext: fixedAssetsReviewed ? "REVIEWED" : "NEEDS_REVIEW", phase: "INITIAL_ACTIVITY_REVIEW", status: "IN_PROGRESS", completedAt: null } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "OpeningBalanceCutover", entityId: openingJournalId ?? cutover.id, afterJson: { cutoverDate: cutoverDate.toISOString().slice(0, 10), balanced: true, zeroBalanceNoJournal: positive.equals(0), accountType, bankFeedMethod, openingBalance: positive.toFixed(2) }, metadataJson: { sourceReference, ownerConfirmed: true, quickBooksApiUsed: false } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { ok: true, message: "Opening journal posted. Books setup remains incomplete until reconciliation and remaining cutover facts are confirmed." };
  } catch { return { ok: false, message: "Cutover setup could not be saved safely." }; }
}

export async function markInitialReconciliationComplete(businessId: string) {
  const onboarding = await prisma.businessOnboarding.findUnique({ where: { businessId } });
  if (!onboarding) return;
  await prisma.businessOnboarding.update({ where: { businessId }, data: { initialReconciliationComplete: true, phase: "READINESS_CHECK", status: "IN_PROGRESS", completedAt: null, booksCurrentThrough: new Date() } });
}
