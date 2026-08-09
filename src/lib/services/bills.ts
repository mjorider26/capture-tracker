import "server-only";

import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { ensureWorkspaceAccountingFoundation } from "@/lib/accounting/workspace-bootstrap";
import { accountingBasisFromPolicy } from "./operational-independence-core";

type Db = PrismaClient | Prisma.TransactionClient;
export type BillActor = { businessId: string; actorUserId: string; actorMembershipId: string; role: "OWNER" | "ADVISOR" | "CPA_READ_ONLY"; executionMode: "authenticated" | "demo" };
const text = (value: unknown, max = 500) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : null;
const money = (value: unknown) => typeof value === "string" && /^\d{1,15}(?:\.\d{1,2})?$/.test(value) ? new Prisma.Decimal(value) : null;
const audit = (actor: BillActor, entityType: string, entityId: string, action: "CREATE" | "UPDATE" | "APPROVE" | "VOID", afterJson: Prisma.InputJsonValue) => ({ actorType: "USER" as const, businessId: actor.businessId, actorMembershipId: actor.actorMembershipId, action, entityType, entityId, afterJson, metadataJson: { executionMode: actor.executionMode, v2_2: true } });

async function basis(tx: Db, businessId: string) {
  const policy = await tx.accountingPolicy.findUnique({ where: { businessId_policyType: { businessId, policyType: "ACCOUNTING_BASIS" } }, include: { currentVersion: true } });
  return accountingBasisFromPolicy(policy?.currentVersion?.content);
}
async function period(tx: Db, businessId: string, entryDate: Date) { return tx.accountingPeriod.findFirst({ where: { businessId, status: "OPEN", startsAt: { lte: entryDate }, endsAt: { gte: entryDate } }, select: { id: true } }); }
async function journal(tx: Db, input: { actor: BillActor; periodId: string; entryNumber: string; entryDate: Date; description: string; sourceType: "BILL_APPROVAL" | "BILL_PAYMENT"; sourceEntityId: string; debitAccountId: string; creditAccountId: string; amount: Prisma.Decimal; memo: string }) {
  const entry = await tx.journalEntry.create({ data: { businessId: input.actor.businessId, accountingPeriodId: input.periodId, entryNumber: input.entryNumber, entryDate: input.entryDate, description: input.description, status: "DRAFT", sourceType: input.sourceType, sourceEntityId: input.sourceEntityId, approvedByMembershipId: input.actor.actorMembershipId } });
  await tx.journalLine.createMany({ data: [
    { businessId: input.actor.businessId, journalEntryId: entry.id, ledgerAccountId: input.debitAccountId, lineNumber: 1, debitAmount: input.amount, creditAmount: "0", memo: input.memo },
    { businessId: input.actor.businessId, journalEntryId: entry.id, ledgerAccountId: input.creditAccountId, lineNumber: 2, debitAmount: "0", creditAmount: input.amount, memo: input.memo },
  ] });
  await tx.journalEntry.update({ where: { id: entry.id }, data: { status: "POSTED", postedAt: new Date() } });
  return entry;
}

export async function createVendor(client: Db, actor: BillActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can create vendors." };
  const name = text(raw.name, 180); if (!name) return { ok: false as const, message: "Enter a vendor name." };
  const vendor = await client.vendor.create({ data: { businessId: actor.businessId, name, contactName: text(raw.contactName, 180), email: text(raw.email, 320), paymentTerms: text(raw.paymentTerms, 180), notes: text(raw.notes, 4000) } });
  await client.auditEvent.create({ data: audit(actor, "Vendor", vendor.id, "CREATE", { name }) });
  return { ok: true as const, id: vendor.id };
}

export async function createBill(client: Db, actor: BillActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can create bills." };
  const vendorId = text(raw.vendorId, 191), description = text(raw.description), ledgerAccountId = text(raw.ledgerAccountId, 191), amount = money(raw.amount), billDate = date(raw.billDate), dueDate = date(raw.dueDate), supportingDocumentId = text(raw.supportingDocumentId, 191);
  if (!vendorId || !description || !ledgerAccountId || !amount || !amount.greaterThan(0) || !billDate || !dueDate) return { ok: false as const, message: "Enter a vendor, expense or asset account, description, positive amount, bill date, and due date." };
  return client.$transaction(async (tx) => {
    const [vendor, account, document] = await Promise.all([
      tx.vendor.findFirst({ where: { id: vendorId, businessId: actor.businessId, isActive: true }, select: { id: true } }),
      tx.ledgerAccount.findFirst({ where: { id: ledgerAccountId, businessId: actor.businessId, isActive: true, type: { in: ["EXPENSE", "ASSET"] } }, select: { id: true } }),
      supportingDocumentId ? tx.document.findFirst({ where: { id: supportingDocumentId, businessId: actor.businessId, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (!vendor || !account || (supportingDocumentId && !document)) return { ok: false as const, message: "Use an active vendor, active expense or asset account, and an ACTIVE+CLEAN supporting document." };
    const bill = await tx.bill.create({ data: { businessId: actor.businessId, vendorId, billNumber: text(raw.billNumber, 180), billDate, dueDate, total: amount, memo: text(raw.memo, 4000), terms: text(raw.terms, 1000), supportingDocumentId, lines: { create: { description, ledgerAccountId, amount, sortOrder: 1 } } } });
    await tx.auditEvent.create({ data: audit(actor, "Bill", bill.id, "CREATE", { amount: amount.toFixed(2), vendorId }) });
    return { ok: true as const, id: bill.id };
  });
}

export async function approveBill(client: Db, actor: BillActor, billId: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can approve bills." };
  await ensureWorkspaceAccountingFoundation(actor.businessId);
  return client.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, businessId: actor.businessId, status: { in: ["DRAFT", "REVIEW"] } }, include: { lines: true, vendor: { select: { name: true } } } });
    if (!bill || !bill.billDate || bill.lines.length === 0) return { ok: false as const, message: "Only a current bill with a bill date and lines can be approved." };
    const accountingBasis = await basis(tx, actor.businessId); let journalId: string | null = null;
    if (accountingBasis === "ACCRUAL") {
      if (bill.lines.length !== 1 || !bill.lines[0].ledgerAccountId) return { ok: false as const, message: "Split bill approval requires an explicit accounting review before posting." };
      const [accounts, open] = await Promise.all([tx.ledgerAccount.findMany({ where: { businessId: actor.businessId, isActive: true, OR: [{ id: bill.lines[0].ledgerAccountId }, { subtype: "ACCOUNTS_PAYABLE" }] }, select: { id: true, subtype: true } }), period(tx, actor.businessId, bill.billDate)]);
      const payable = accounts.find((account) => account.subtype === "ACCOUNTS_PAYABLE")?.id;
      if (!payable || !open) return { ok: false as const, message: "Accounts Payable and an open accounting period are required before accrual posting." };
      const entry = await journal(tx, { actor, periodId: open.id, entryNumber: `BILL-APPROVE-${bill.id}`, entryDate: bill.billDate, description: `Bill approved: ${bill.vendor.name}`, sourceType: "BILL_APPROVAL", sourceEntityId: bill.id, debitAccountId: bill.lines[0].ledgerAccountId, creditAccountId: payable, amount: bill.total, memo: `Bill ${bill.billNumber ?? bill.id}` }); journalId = entry.id;
    }
    const claimed = await tx.bill.updateMany({ where: { id: bill.id, businessId: actor.businessId, status: { in: ["DRAFT", "REVIEW"] }, approvalJournalEntryId: null }, data: { status: "APPROVED", approvalJournalEntryId: journalId, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("Concurrent bill approval");
    await tx.auditEvent.create({ data: audit(actor, "Bill", bill.id, "APPROVE", { accountingBasis, journalId }) });
    return { ok: true as const, accountingBasis };
  }).catch(() => ({ ok: false as const, message: "The bill could not be approved safely. Refresh and try again." }));
}

export async function recordBillPayment(client: Db, actor: BillActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can record bill payments." };
  const billId = text(raw.billId, 191), amount = money(raw.amount), paidAt = date(raw.paidAt), financialAccountId = text(raw.financialAccountId, 191), externalTransactionId = text(raw.externalTransactionId, 191);
  if (!billId || !amount || !amount.greaterThan(0) || !paidAt) return { ok: false as const, message: "Enter a positive payment and payment date." };
  await ensureWorkspaceAccountingFoundation(actor.businessId);
  return client.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, businessId: actor.businessId, status: { in: ["APPROVED", "DUE", "PARTIALLY_PAID"] } }, include: { payments: { select: { amount: true } }, lines: { select: { ledgerAccountId: true } }, vendor: { select: { name: true } } } });
    if (!bill) return { ok: false as const, message: "Choose an approved bill that is not paid or void." };
    const paid = bill.payments.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)); if (paid.add(amount).greaterThan(bill.total)) return { ok: false as const, message: "Payment exceeds the remaining bill balance." };
    const external = externalTransactionId ? await tx.externalTransaction.findFirst({ where: { id: externalTransactionId, businessId: actor.businessId, direction: "OUTFLOW" }, select: { id: true, amount: true, financialAccountId: true } }) : null;
    if ((externalTransactionId && !external) || (external && !external.amount.equals(amount))) return { ok: false as const, message: "Bank evidence must be available and exactly match the payment." };
    const accountingBasis = await basis(tx, actor.businessId); const cashFinancialAccountId = external?.financialAccountId ?? financialAccountId;
    const payment = await tx.billPayment.create({ data: { businessId: actor.businessId, billId, amount, paidAt, externalTransactionId: external?.id, reference: text(raw.reference, 500), recordedByUserId: actor.actorUserId } });
    let journalId: string | null = null;
    if (accountingBasis !== "NEEDS_REVIEW") {
      const [accounts, open] = await Promise.all([tx.ledgerAccount.findMany({ where: { businessId: actor.businessId, isActive: true, OR: [{ subtype: "ACCOUNTS_PAYABLE" }, ...(accountingBasis === "CASH" && bill.lines[0]?.ledgerAccountId ? [{ id: bill.lines[0].ledgerAccountId }] : []), ...(cashFinancialAccountId ? [{ financialAccountId: cashFinancialAccountId }] : [{ financialAccountId: { not: null } }]) ] }, select: { id: true, subtype: true, financialAccountId: true } }), period(tx, actor.businessId, paidAt)]);
      const cash = accounts.find((account) => cashFinancialAccountId ? account.financialAccountId === cashFinancialAccountId : account.financialAccountId !== null)?.id;
      const payable = accounts.find((account) => account.subtype === "ACCOUNTS_PAYABLE")?.id; const expense = bill.lines[0]?.ledgerAccountId;
      if (!cash || !open || (accountingBasis === "ACCRUAL" && !payable) || (accountingBasis === "CASH" && !expense)) return { ok: false as const, message: "A mapped cash account, required ledger account, and open accounting period are required before payment posting." };
      const entry = await journal(tx, { actor, periodId: open.id, entryNumber: `BILL-PAY-${payment.id}`, entryDate: paidAt, description: `Bill payment: ${bill.vendor.name}`, sourceType: "BILL_PAYMENT", sourceEntityId: payment.id, debitAccountId: accountingBasis === "ACCRUAL" ? payable! : expense!, creditAccountId: cash, amount, memo: `Bill ${bill.billNumber ?? bill.id} payment` }); journalId = entry.id;
      await tx.billPayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } });
    }
    const newPaid = paid.add(amount); const status = newPaid.equals(bill.total) ? "PAID" : "PARTIALLY_PAID";
    await tx.bill.update({ where: { id: bill.id }, data: { status, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: audit(actor, "BillPayment", payment.id, "CREATE", { billId, amount: amount.toFixed(2), accountingBasis, journalId, externalTransactionId: external?.id ?? null }) });
    return { ok: true as const, id: payment.id, status };
  });
}

export async function matchBillPaymentEvidence(client: Db, actor: BillActor, billPaymentId: string, externalTransactionId: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can confirm payment evidence." };
  return client.$transaction(async (tx) => {
    const [payment, external] = await Promise.all([tx.billPayment.findFirst({ where: { id: billPaymentId, businessId: actor.businessId, externalTransactionId: null }, select: { id: true, amount: true, journalEntryId: true } }), tx.externalTransaction.findFirst({ where: { id: externalTransactionId, businessId: actor.businessId, direction: "OUTFLOW" }, select: { id: true, amount: true } })]);
    if (!payment || !external || !payment.amount.equals(external.amount)) return { ok: false as const, message: "Choose matching payment evidence with the same amount." };
    try { await tx.billPayment.update({ where: { id: payment.id }, data: { externalTransactionId: external.id } }); } catch { return { ok: false as const, message: "This bank activity is already linked to another payment." }; }
    await tx.auditEvent.create({ data: audit(actor, "BillPayment", payment.id, "UPDATE", { externalTransactionId: external.id, evidenceMatched: true, journalId: payment.journalEntryId, corroborationOnly: Boolean(payment.journalEntryId) }) });
    return { ok: true as const };
  });
}

export async function voidBill(client: Db, actor: BillActor, billId: string, reason: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can void bills." };
  const trimmed = reason.trim(); if (!trimmed || trimmed.length > 1000) return { ok: false as const, message: "Provide a concise void reason." };
  return client.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({ where: { id: billId, businessId: actor.businessId, status: { in: ["DRAFT", "REVIEW"] } }, include: { payments: { select: { id: true } } } });
    if (!bill || bill.payments.length) return { ok: false as const, message: "Only an unposted, unpaid draft or review bill can be voided. Posted bills require a controlled reversal." };
    await tx.bill.update({ where: { id: bill.id }, data: { status: "VOID", voidedAt: new Date(), voidReason: trimmed, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: audit(actor, "Bill", bill.id, "VOID", { reason: trimmed }) }); return { ok: true as const };
  });
}
