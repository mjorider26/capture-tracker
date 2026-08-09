import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { classificationMatchesDirection, ownerTransferSchema } from "./owner-transfer-core";
import type { ReimbursementActor } from "./reimbursement-core";
import { ensureWorkspaceAccountingFoundation } from "@/lib/accounting/workspace-bootstrap";
import { captureDistributionReadinessSnapshot } from "./s-corp-intelligence";
type Client = Pick<PrismaClient, "$transaction"> & { externalTransaction: PrismaClient["externalTransaction"]; ownerMoneyTransfer: PrismaClient["ownerMoneyTransfer"]; };
export async function classifyOwnerTransfer(client: Client, actor: ReimbursementActor, input: unknown): Promise<{ ok: true; transferId: string } | { ok: false; message: string }> {
  if (actor.role !== "OWNER") return { ok: false, message: "Only the business owner can classify owner transfers." };
  const parsed = ownerTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Transfer classification is invalid." };
  const data = parsed.data;
  if (!classificationMatchesDirection(data.direction, data.classification)) return { ok: false, message: "That treatment does not match the selected transfer direction." };
  try { await ensureWorkspaceAccountingFoundation(actor.businessId); return await client.$transaction(async (tx) => {
    const external = await tx.externalTransaction.findFirst({ where: { id: data.externalTransactionId, businessId: actor.businessId, postedTransactionId: null, status: { notIn: ["DUPLICATE", "INVALID", "IGNORED"] } }, select: { id: true } });
    if (!external) return { ok: false as const, message: "That imported bank record is unavailable for owner-transfer review." };
    const status = data.classification === "UNRESOLVED" || data.classification === "OTHER" ? "PENDING_REVIEW" : "CLASSIFIED";
    const transfer = await tx.ownerMoneyTransfer.upsert({ where: { businessId_externalTransactionId: { businessId: actor.businessId, externalTransactionId: external.id } }, create: { businessId: actor.businessId, externalTransactionId: external.id, direction: data.direction, classification: data.classification, status, notes: data.notes, classifiedAt: status === "CLASSIFIED" ? new Date() : null, classifiedByUserId: status === "CLASSIFIED" ? actor.actorUserId : null }, update: { direction: data.direction, classification: data.classification, status, notes: data.notes, classifiedAt: status === "CLASSIFIED" ? new Date() : null, classifiedByUserId: status === "CLASSIFIED" ? actor.actorUserId : null, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "OwnerMoneyTransfer", entityId: transfer.id, afterJson: { direction: data.direction, classification: data.classification, status }, metadataJson: { executionMode: actor.executionMode, externalTransactionId: external.id } } });
    return { ok: true as const, transferId: transfer.id };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, message: "The transfer classification could not be saved safely. Refresh and try again." }; return { ok: false, message: "The transfer classification could not be saved safely. Refresh and try again." }; }
}

/** Posts only an already-explicit owner transfer treatment; imports never infer a treatment. */
export async function postClassifiedOwnerTransfer(client: Client, actor: ReimbursementActor, input: unknown): Promise<{ ok: true; journalEntryId: string } | { ok: false; message: string }> {
  if (actor.role !== "OWNER") return { ok: false, message: "Only the business owner can post an explicitly reviewed owner transfer." };
  const parsed = ownerTransferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "The transfer posting request is invalid." };
  const data = parsed.data;
  if (["UNRESOLVED", "OTHER", "PAYROLL_NET_SALARY", "REIMBURSEMENT"].includes(data.classification)) return { ok: false, message: "This treatment requires a linked payroll or reimbursement workflow, or must remain under review." };
  try { await ensureWorkspaceAccountingFoundation(actor.businessId); return await client.$transaction(async (tx) => {
    const external = await tx.externalTransaction.findFirst({ where: { id: data.externalTransactionId, businessId: actor.businessId, postedTransactionId: null, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, include: { financialAccount: { include: { ledgerAccount: true } } } });
    if (!external?.financialAccount.ledgerAccount) return { ok: false as const, message: "That bank evidence is unavailable for owner-transfer posting." };
    const expectedDirection = data.direction === "COMPANY_TO_OWNER" ? "OUTFLOW" : "INFLOW";
    if (external.direction !== expectedDirection) return { ok: false as const, message: "The selected bank direction does not match the explicit owner-transfer direction." };
    const period = await tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: external.transactionDate }, endsAt: { gte: external.transactionDate } }, select: { id: true } });
    if (!period) return { ok: false as const, message: "The transfer date belongs to a closed accounting period." };
    const subtype = data.classification === "SHAREHOLDER_DISTRIBUTION" ? "OWNER_DISTRIBUTION" : data.classification === "OWNER_CONTRIBUTION" ? "OWNER_CONTRIBUTION" : "LONG_TERM_LIABILITY";
    const treatment = await tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, subtype, isActive: true }, select: { id: true } });
    if (!treatment) return { ok: false as const, message: "The required owner-equity or shareholder-loan account is unavailable." };
    const transfer = await tx.ownerMoneyTransfer.upsert({ where: { businessId_externalTransactionId: { businessId: actor.businessId, externalTransactionId: external.id } }, create: { businessId: actor.businessId, externalTransactionId: external.id, direction: data.direction, classification: data.classification, status: "CLASSIFIED", notes: data.notes, classifiedAt: new Date(), classifiedByUserId: actor.actorUserId }, update: { direction: data.direction, classification: data.classification, status: "CLASSIFIED", notes: data.notes, classifiedAt: new Date(), classifiedByUserId: actor.actorUserId, version: { increment: 1 } } });
    const transaction = await tx.transaction.create({ data: { businessId: actor.businessId, accountId: external.financialAccountId, postedAt: external.transactionDate, description: external.description, merchantName: external.normalizedMerchant, amount: external.amount, direction: external.direction, intent: "BUSINESS", status: "APPROVED", sourceReference: external.externalTransactionId ?? `owner-transfer:${external.id}`, approvedAt: new Date(), approvedByMembershipId: actor.actorUserId } });
    const distribution = data.classification === "SHAREHOLDER_DISTRIBUTION" ? await tx.ownerDistribution.create({ data: { businessId: actor.businessId, distributionDate: external.transactionDate, amount: external.amount, status: "PAID", sourceAccountId: external.financialAccountId, transactionId: transaction.id, memo: data.notes, approvedAt: new Date(), paidAt: new Date() } }) : null;
    const journal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `OWN-${external.id}`, entryDate: external.transactionDate, description: external.description, status: "DRAFT", sourceType: distribution ? "OWNER_DISTRIBUTION" : "MANUAL", sourceEntityId: transfer.id, transactionId: transaction.id, ownerDistributionId: distribution?.id, approvedByMembershipId: actor.actorUserId } });
    const cash = external.financialAccount.ledgerAccount.id, amount = external.amount.toFixed(2);
    const companyToOwner = data.direction === "COMPANY_TO_OWNER";
    await tx.journalLine.createMany({ data: companyToOwner ? [
      { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: treatment.id, lineNumber: 1, debitAmount: amount, creditAmount: "0", memo: data.classification.replaceAll("_", " ") },
      { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: cash, lineNumber: 2, debitAmount: "0", creditAmount: amount, memo: "Owner transfer cash" },
    ] : [
      { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: cash, lineNumber: 1, debitAmount: amount, creditAmount: "0", memo: "Owner transfer cash" },
      { businessId: actor.businessId, journalEntryId: journal.id, ledgerAccountId: treatment.id, lineNumber: 2, debitAmount: "0", creditAmount: amount, memo: data.classification.replaceAll("_", " ") },
    ] });
    await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
    const claimed = await tx.externalTransaction.updateMany({ where: { id: external.id, businessId: actor.businessId, postedTransactionId: null }, data: { status: "POSTED", postedTransactionId: transaction.id, reviewedAt: new Date(), reviewedByUserId: actor.actorUserId, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Concurrent owner transfer posting");
    await tx.ownerMoneyTransfer.update({ where: { id: transfer.id }, data: { status: "MATCHED", version: { increment: 1 } } });
    if (distribution) {
      const snapshot = await captureDistributionReadinessSnapshot(tx, actor, distribution.id, external.transactionDate.getUTCFullYear(), data.acknowledgeDistributionReadiness === "on");
      if (!snapshot.ok) throw new Error("Distribution readiness snapshot unavailable");
    }
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "APPROVE", entityType: "OwnerMoneyTransfer", entityId: transfer.id, afterJson: { classification: data.classification, direction: data.direction, transactionId: transaction.id, journalEntryId: journal.id }, metadataJson: { executionMode: actor.executionMode, accountingEffect: "posted" } } });
    return { ok: true as const, journalEntryId: journal.id };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError) return { ok: false, message: "The owner transfer could not be posted safely. Refresh and try again." }; return { ok: false, message: "The owner transfer could not be posted safely. Refresh and try again." }; }
}
