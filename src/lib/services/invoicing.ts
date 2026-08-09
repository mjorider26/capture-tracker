import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { accountingBasisFromPolicy, paymentStatus } from "./operational-independence-core";

type Db = PrismaClient | Prisma.TransactionClient;
export type InvoiceActor = { businessId: string; actorUserId: string; actorMembershipId: string; role: "OWNER" | "ADVISOR" | "CPA_READ_ONLY"; executionMode: "authenticated" | "demo" };
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : null;
const money = (value: unknown) => typeof value === "string" && /^\d{1,15}(?:\.\d{1,2})?$/.test(value) ? new Prisma.Decimal(value) : null;
const text = (value: unknown, max = 500) => typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const audit = (actor: InvoiceActor, entityType: string, entityId: string, action: "CREATE" | "UPDATE" | "APPROVE" | "VOID", afterJson: Prisma.InputJsonValue) => ({ actorType: "USER" as const, businessId: actor.businessId, actorMembershipId: actor.actorMembershipId, action, entityType, entityId, afterJson, metadataJson: { executionMode: actor.executionMode, v2_2: true } });

async function basis(client: Db, businessId: string) {
  const policy = await client.accountingPolicy.findUnique({ where: { businessId_policyType: { businessId, policyType: "ACCOUNTING_BASIS" } }, include: { currentVersion: true } });
  return accountingBasisFromPolicy(policy?.currentVersion?.content);
}
async function nextNumber(client: Db, businessId: string) {
  const latest = await client.invoice.findFirst({ where: { businessId }, orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  const number = latest?.invoiceNumber.match(/^INV-(\d+)$/)?.[1];
  return `INV-${(Number(number ?? 1000) + 1).toString().padStart(4, "0")}`;
}

export async function createCustomer(client: Db, actor: InvoiceActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can create customers." };
  const businessName = text(raw.businessName, 180); if (!businessName) return { ok: false as const, message: "Enter a customer or business name." };
  const customer = await client.customer.create({ data: { businessId: actor.businessId, businessName, contactName: text(raw.contactName, 180), email: text(raw.email, 320), billingAddress: text(raw.billingAddress, 4000), notes: text(raw.notes, 4000) } });
  await client.auditEvent.create({ data: audit(actor, "Customer", customer.id, "CREATE", { businessName }) }); return { ok: true as const, id: customer.id };
}

export async function createInvoice(client: Db, actor: InvoiceActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can create invoices." };
  const customerId = text(raw.customerId, 191), description = text(raw.description), quantity = money(raw.quantity), rate = money(raw.rate);
  if (!customerId || !description || !quantity || !rate || !quantity.greaterThan(0) || !rate.greaterThanOrEqualTo(0)) return { ok: false as const, message: "Enter a customer, service description, quantity, and rate." };
  const dueDate = date(raw.dueDate), issueDate = date(raw.issueDate); if (!dueDate || !issueDate) return { ok: false as const, message: "Enter issue and due dates." };
  const total = quantity.mul(rate).toDecimalPlaces(2); const token = randomBytes(32).toString("base64url");
  try { return await client.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, businessId: actor.businessId, isActive: true }, select: { id: true } }); if (!customer) return { ok: false as const, message: "Choose an active customer." };
    const invoice = await tx.invoice.create({ data: { businessId: actor.businessId, customerId, invoiceNumber: await nextNumber(tx, actor.businessId), publicTokenHash: hash(token), issueDate, dueDate, subtotal: total, total, memo: text(raw.memo, 4000), terms: text(raw.terms, 1000), paymentInstructions: text(raw.paymentInstructions, 4000), lines: { create: { description, quantity, rate, amount: total, sortOrder: 1 } } } });
    await tx.auditEvent.create({ data: audit(actor, "Invoice", invoice.id, "CREATE", { invoiceNumber: invoice.invoiceNumber, total: total.toFixed(2) }) }); return { ok: true as const, id: invoice.id, invoiceNumber: invoice.invoiceNumber, publicToken: token };
  }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return createInvoice(client, actor, raw); return { ok: false as const, message: "The invoice could not be saved safely." }; }
}

export async function issueInvoice(client: Db, actor: InvoiceActor, invoiceId: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can issue invoices." };
  return client.$transaction(async (tx) => { const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId: actor.businessId, status: "DRAFT" }, select: { id: true, version: true, issueDate: true, dueDate: true } }); if (!invoice) return { ok: false as const, message: "Only a current draft invoice can be issued." };
    const accountingBasis = await basis(tx, actor.businessId); await tx.invoice.update({ where: { id: invoice.id }, data: { status: paymentStatus("1", "0", true, invoice.dueDate), version: { increment: 1 } } }); await tx.auditEvent.create({ data: audit(actor, "Invoice", invoice.id, "APPROVE", { issued: true, accountingBasis }) }); return { ok: true as const, accountingBasis }; });
}

/** Records an owner-confirmed fact. A later bank match must reuse this payment rather than create revenue again. */
export async function recordInvoicePayment(client: Db, actor: InvoiceActor, raw: Record<string, unknown>) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can record invoice payments." };
  const invoiceId = text(raw.invoiceId, 191), amount = money(raw.amount), receivedAt = date(raw.receivedAt);
  if (!invoiceId || !amount || !amount.greaterThan(0) || !receivedAt) return { ok: false as const, message: "Enter a payment date and positive amount." };
  return client.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId: actor.businessId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } }, include: { payments: { select: { amount: true } } } });
    if (!invoice) return { ok: false as const, message: "Choose an issued invoice that is not already paid or void." };
    const paid = invoice.payments.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    if (paid.add(amount).greaterThan(invoice.total)) return { ok: false as const, message: "Payment exceeds the remaining invoice balance." };
    const payment = await tx.invoicePayment.create({ data: { businessId: actor.businessId, invoiceId, amount, receivedAt, reference: text(raw.reference, 500), recordedByUserId: actor.actorUserId } });
    const status = paymentStatus(invoice.total.toFixed(2), paid.add(amount).toFixed(2), true, invoice.dueDate);
    await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
    await tx.auditEvent.create({ data: audit(actor, "InvoicePayment", payment.id, "CREATE", { invoiceId, amount: amount.toFixed(2), receivedAt: receivedAt.toISOString(), accountingBasis: await basis(tx, actor.businessId) }) });
    return { ok: true as const, id: payment.id, status };
  });
}

/** Returns evidence candidates only; matching never posts or records revenue without owner confirmation. */
export async function suggestInvoicePayments(client: Db, businessId: string, invoiceId: string) {
  const invoice = await client.invoice.findFirst({ where: { id: invoiceId, businessId }, include: { customer: { select: { businessName: true } }, payments: { select: { amount: true } } } });
  if (!invoice) return [];
  const remaining = invoice.total.minus(invoice.payments.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)));
  return client.externalTransaction.findMany({ where: { businessId, direction: "INFLOW", status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] }, amount: { lte: remaining }, transactionDate: { gte: new Date(invoice.issueDate?.getTime() ?? 0) } }, select: { id: true, amount: true, transactionDate: true, description: true, sourceReference: true }, orderBy: { transactionDate: "asc" }, take: 20 }).then((items) => items.map((item) => ({ ...item, confidence: item.amount.equals(remaining) && new RegExp(invoice.invoiceNumber, "i").test(`${item.description} ${item.sourceReference ?? ""}`) ? "STRONG" : "POSSIBLE" })));
}

export async function matchInvoicePaymentEvidence(client: Db, actor: InvoiceActor, invoicePaymentId: string, externalTransactionId: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can confirm payment evidence." };
  return client.$transaction(async (tx) => { const payment = await tx.invoicePayment.findFirst({ where: { id: invoicePaymentId, businessId: actor.businessId, externalTransactionId: null }, select: { id: true, amount: true } }); const external = await tx.externalTransaction.findFirst({ where: { id: externalTransactionId, businessId: actor.businessId, direction: "INFLOW" }, select: { id: true, amount: true } }); if (!payment || !external || !payment.amount.equals(external.amount)) return { ok: false as const, message: "Choose matching payment evidence with the same amount." };
    try { await tx.invoicePayment.update({ where: { id: payment.id }, data: { externalTransactionId: external.id } }); } catch { return { ok: false as const, message: "This bank activity is already linked to another payment." }; }
    await tx.auditEvent.create({ data: audit(actor, "InvoicePayment", payment.id, "UPDATE", { externalTransactionId: external.id, evidenceMatched: true }) }); return { ok: true as const }; });
}

export async function voidInvoice(client: Db, actor: InvoiceActor, invoiceId: string, reason: string) {
  if (actor.role !== "OWNER") return { ok: false as const, message: "Only the business owner can void invoices." };
  const trimmed = reason.trim(); if (!trimmed || trimmed.length > 1000) return { ok: false as const, message: "Provide a concise void reason." };
  return client.$transaction(async (tx) => { const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, businessId: actor.businessId, status: { in: ["DRAFT", "ISSUED", "OVERDUE"] } }, include: { payments: { select: { id: true } } } }); if (!invoice || invoice.payments.length) return { ok: false as const, message: "Only an unpaid draft or issued invoice can be voided." };
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "VOID", voidedAt: new Date(), voidReason: trimmed } }); await tx.auditEvent.create({ data: audit(actor, "Invoice", invoice.id, "VOID", { reason: trimmed }) }); return { ok: true as const }; });
}

export async function publicInvoice(client: Db, token: string) { return client.invoice.findFirst({ where: { publicTokenHash: hash(token), status: { in: ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] } }, select: { invoiceNumber: true, issueDate: true, dueDate: true, status: true, total: true, memo: true, terms: true, paymentInstructions: true, customer: { select: { businessName: true, contactName: true, billingAddress: true } }, business: { select: { displayName: true, legalName: true } }, lines: { select: { description: true, quantity: true, rate: true, amount: true }, orderBy: { sortOrder: "asc" } } } }); }
