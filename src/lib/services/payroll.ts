import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { payrollEntrySchema, payrollMatchStatus, payrollPreview } from "./payroll-core";

type Actor = { businessId: string; actorUserId: string; role: "OWNER" | "ADVISOR"; executionMode: string };
type Client = Pick<PrismaClient, "$transaction">;
type Result = { ok: true; payrollRunId: string; journalEntryId: string } | { ok: false; message: string };
const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);

export async function recordPayrollRun(client: Client, actor: Actor, input: unknown): Promise<Result> {
  if (actor.role !== "OWNER") return { ok: false, message: "Only the business owner can record reviewed payroll results." };
  const parsed = payrollEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Payroll input is invalid." };
  const data = parsed.data;
  const preview = payrollPreview(data);
  if (!preview.netPayCheck || !preview.balanced) return { ok: false, message: "Payroll amounts do not balance. Gross wages must equal net pay plus employee withholding, employee payroll taxes, and deductions." };
  try {
    return await client.$transaction(async (tx) => {
      const [cashAccount, period, document, payrollExpense, payrollTaxExpense, payrollTaxPayable, feeExpense] = await Promise.all([
        tx.financialAccount.findFirst({ where: { id: data.cashAccountId, businessId: actor.businessId, ownership: "BUSINESS", isActive: true }, select: { id: true, ledgerAccount: { select: { id: true, type: true, isActive: true } } } }),
        tx.accountingPeriod.findFirst({ where: { businessId: actor.businessId, status: "OPEN", startsAt: { lte: dateAtNoon(data.payDate) }, endsAt: { gte: dateAtNoon(data.payDate) } }, select: { id: true } }),
        data.documentId ? tx.document.findFirst({ where: { id: data.documentId, businessId: actor.businessId, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true } }) : Promise.resolve(null),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, isActive: true, subtype: "PAYROLL_EXPENSE" }, select: { id: true } }),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, isActive: true, subtype: "PAYROLL_TAX_EXPENSE" }, select: { id: true } }),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, isActive: true, subtype: "PAYROLL_TAX_PAYABLE" }, select: { id: true } }),
        tx.ledgerAccount.findFirst({ where: { businessId: actor.businessId, isActive: true, subtype: "PROFESSIONAL_FEES_EXPENSE" }, select: { id: true } }),
      ]);
      if (!cashAccount?.ledgerAccount || cashAccount.ledgerAccount.type !== "ASSET" || !cashAccount.ledgerAccount.isActive) return { ok: false as const, message: "Choose an active business cash account." };
      if (!period) return { ok: false as const, message: "The pay date belongs to a closed accounting period." };
      if (data.documentId && !document) return { ok: false as const, message: "The selected payroll evidence is not available." };
      if (!payrollExpense || !payrollTaxExpense || !payrollTaxPayable || (!new Prisma.Decimal(data.providerFee).isZero() && !feeExpense)) return { ok: false as const, message: "Required payroll ledger accounts are unavailable. Ask the owner or CPA to configure the chart of accounts." };
      const existing = data.externalReference ? await tx.payrollRun.findFirst({ where: { businessId: actor.businessId, externalReference: data.externalReference }, select: { id: true, journalEntry: { select: { id: true } } } }) : null;
      if (existing?.journalEntry) return { ok: true as const, payrollRunId: existing.id, journalEntryId: existing.journalEntry.id };
      if (existing) return { ok: false as const, message: "This provider reference already exists without a completed journal. Review it before retrying." };
      const run = await tx.payrollRun.create({ data: {
        businessId: actor.businessId, payPeriodStart: dateAtNoon(data.payPeriodStart), payPeriodEnd: dateAtNoon(data.payPeriodEnd), payDate: dateAtNoon(data.payDate), status: "APPROVED",
        grossWages: data.grossWages, employeeWithholding: preview.employeeWithholding, employeePayrollTax: preview.employeePayrollTax, otherDeductions: data.otherDeductions,
        federalWithholding: data.federalWithholding, stateLocalWithholding: data.stateLocalWithholding, employeeSocialSecurity: data.employeeSocialSecurity, employeeMedicare: data.employeeMedicare,
        employerPayrollTax: preview.employerPayrollTax, employerSocialSecurity: data.employerSocialSecurity, employerMedicare: data.employerMedicare, otherEmployerPayrollTax: data.otherEmployerPayrollTax,
        netPay: data.netPay, providerFee: data.providerFee, cashAccountId: cashAccount.id, payrollProvider: data.payrollProvider || null, externalReference: data.externalReference || null, documentId: document?.id, approvedAt: new Date(),
      } });
      const journal = await tx.journalEntry.create({ data: { businessId: actor.businessId, accountingPeriodId: period.id, entryNumber: `PAY-${run.id}`, entryDate: dateAtNoon(data.payDate), description: `Payroll result${data.payrollProvider ? ` · ${data.payrollProvider}` : ""}`, status: "DRAFT", sourceType: "PAYROLL_RUN", sourceEntityId: run.id, payrollRunId: run.id, approvedByMembershipId: actor.actorUserId } });
      const lines = [
        { ledgerAccountId: payrollExpense.id, debitAmount: data.grossWages, creditAmount: "0", memo: "Gross wages" },
        { ledgerAccountId: payrollTaxExpense.id, debitAmount: preview.employerPayrollTax, creditAmount: "0", memo: "Employer payroll taxes" },
        ...(new Prisma.Decimal(data.providerFee).isZero() ? [] : [{ ledgerAccountId: feeExpense!.id, debitAmount: data.providerFee, creditAmount: "0", memo: "Payroll provider fee" }]),
        { ledgerAccountId: payrollTaxPayable.id, debitAmount: "0", creditAmount: preview.payrollLiabilities, memo: "Payroll liabilities" },
        { ledgerAccountId: cashAccount.ledgerAccount.id, debitAmount: "0", creditAmount: preview.cashCredit, memo: "Net pay and provider fee cash clearing" },
      ];
      await tx.journalLine.createMany({ data: lines.map((line, index) => ({ businessId: actor.businessId, journalEntryId: journal.id, lineNumber: index + 1, ...line })) });
      await tx.journalEntry.update({ where: { id: journal.id }, data: { status: "POSTED", postedAt: new Date() } });
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "PROCESSED", processedAt: new Date() } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "PayrollRun", entityId: run.id, afterJson: { payDate: data.payDate, grossWages: data.grossWages, netPay: data.netPay, payrollLiabilities: preview.payrollLiabilities, providerFee: data.providerFee, journalEntryId: journal.id }, metadataJson: { executionMode: actor.executionMode, accountingEffect: "posted", sourceEvidence: Boolean(document) } } });
      return { ok: true as const, payrollRunId: run.id, journalEntryId: journal.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, message: "That payroll provider reference already exists. Refresh and review the existing record." };
    return { ok: false, message: "The payroll result could not be recorded safely. Refresh and try again." };
  }
}

export async function matchPayrollEvidence(client: Client, actor: Actor, input: { payrollRunId?: string; externalTransactionId?: string; kind?: string; notes?: string }): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
  if (actor.role !== "OWNER" || !input.payrollRunId || !input.externalTransactionId || !["NET_PAY", "PAYROLL_TAX", "PROVIDER_FEE"].includes(input.kind ?? "")) return { ok: false, message: "The payroll match request is invalid." };
  try { return await client.$transaction(async (tx) => {
    const [run, external] = await Promise.all([
      tx.payrollRun.findFirst({ where: { id: input.payrollRunId, businessId: actor.businessId, status: "PROCESSED" } }),
      tx.externalTransaction.findFirst({ where: { id: input.externalTransactionId, businessId: actor.businessId, status: { notIn: ["DUPLICATE", "INVALID", "IGNORED"] } } }),
    ]);
    if (!run || !external) return { ok: false as const, message: "The payroll record or bank evidence is unavailable." };
    const expected = input.kind === "NET_PAY" ? run.netPay : input.kind === "PROVIDER_FEE" ? run.providerFee : run.employeeWithholding.plus(run.employeePayrollTax).plus(run.otherDeductions).plus(run.employerPayrollTax);
    const status = payrollMatchStatus(expected.toFixed(2), external.amount.toFixed(2));
    await tx.payrollBankMatch.upsert({ where: { businessId_payrollRunId_externalTransactionId_kind: { businessId: actor.businessId, payrollRunId: run.id, externalTransactionId: external.id, kind: input.kind! } }, create: { businessId: actor.businessId, payrollRunId: run.id, externalTransactionId: external.id, kind: input.kind!, expectedAmount: expected, matchedAmount: external.amount, status, notes: input.notes?.slice(0, 1000), matchedAt: new Date() }, update: { expectedAmount: expected, matchedAmount: external.amount, status, notes: input.notes?.slice(0, 1000), matchedAt: new Date(), version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "PayrollBankMatch", entityId: run.id, afterJson: { kind: input.kind, status }, metadataJson: { executionMode: actor.executionMode } } });
    return { ok: true as const, status };
  }); } catch { return { ok: false, message: "The payroll evidence could not be matched safely." }; }
}
