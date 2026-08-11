import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { AppShell } from "@/components/app-shell";
import { AccountingNav } from "@/components/accounting-nav";
import { BillCenter } from "@/components/bill-center";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { prisma } from "@/lib/prisma";
import { approveBillAction, createBillAction, createVendorAction, recordBillPaymentAction } from "./actions";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  const [vendors, accounts, financialAccounts, bills, params] = await Promise.all([
    prisma.vendor.findMany({ where: { businessId: context.business.id, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ledgerAccount.findMany({ where: { businessId: context.business.id, isActive: true, type: { in: ["EXPENSE", "ASSET"] } }, select: { id: true, name: true }, orderBy: { code: "asc" } }),
    prisma.financialAccount.findMany({ where: { businessId: context.business.id, ownership: "BUSINESS", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.bill.findMany({ where: { businessId: context.business.id }, select: { id: true, billNumber: true, total: true, dueDate: true, status: true, vendor: { select: { name: true } }, payments: { select: { amount: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    searchParams,
  ]);
  const canMutate = context.membership.role === "OWNER";
  return <AppShell mode="app" destination="money" businessName={context.business.displayName}><AccountingNav basePath="/app" active="bills"/><BillCenter vendors={vendors} accounts={accounts} financialAccounts={financialAccounts} bills={bills.map((item) => ({ id: item.id, vendor: item.vendor.name, billNumber: item.billNumber, total: item.total.toFixed(2), paid: item.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).toFixed(2), dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null, status: item.status }))} vendorAction={createVendorAction} billAction={createBillAction} approveAction={approveBillAction} paymentAction={recordBillPaymentAction} canMutate={canMutate} initialOpen={canMutate && params.new === "bill"}/></AppShell>;
}
