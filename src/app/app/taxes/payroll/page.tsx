import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PayrollExperience } from "@/components/taxes-experience";
import { PayrollEntryExperience } from "@/components/payroll-entry-experience";
import { TaxesNav } from "@/components/taxes-nav";
import { getTaxesDashboard } from "@/lib/data/taxes";
import {
  isAccessControlError,
  requireBusinessContext,
} from "@/lib/security/business-context";
import { prisma } from "@/lib/prisma";
import { matchAuthenticatedPayrollEvidence, recordAuthenticatedPayroll } from "./actions";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };
async function getContext() {
  try {
    return await requireBusinessContext();
  } catch (error) {
    if (isAccessControlError(error)) notFound();
    throw error;
  }
}
export default async function PayrollPage() {
  const context = await getContext();
  const [data, accounts, documents, runs, externalTransactions] = await Promise.all([
    getTaxesDashboard(context.business.id),
    prisma.financialAccount.findMany({ where: { businessId: context.business.id, ownership: "BUSINESS", isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.document.findMany({ where: { businessId: context.business.id, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true, originalFilename: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.payrollRun.findMany({ where: { businessId: context.business.id, status: "PROCESSED" }, select: { id: true, payDate: true }, orderBy: { payDate: "desc" }, take: 50 }),
    prisma.externalTransaction.findMany({ where: { businessId: context.business.id, postedTransactionId: null, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, select: { id: true, description: true, amount: true }, orderBy: { transactionDate: "desc" }, take: 100 }),
  ]);
  return (
    <AppShell
      mode="app"
      destination="taxes"
      businessName={context.business.displayName}
    >
      <TaxesNav basePath="/app" />
      <PayrollExperience data={data} />
      <PayrollEntryExperience action={recordAuthenticatedPayroll} matchAction={matchAuthenticatedPayrollEvidence} accounts={accounts} documents={documents} runs={runs.map((run) => ({ id: run.id, payDate: run.payDate.toISOString().slice(0, 10) }))} externalTransactions={externalTransactions.map((item) => ({ id: item.id, description: item.description, amount: item.amount.toFixed(2) }))} />
    </AppShell>
  );
}
