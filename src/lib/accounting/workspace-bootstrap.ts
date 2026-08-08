import "server-only";

import { prisma } from "@/lib/prisma";

const id = (businessId: string, name: string) => `workspace-${businessId}-${name}`;
const startOfYear = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
const endOfYear = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), 11, 31, 23, 59, 59, 999));

/** Creates only deterministic minimum records; retries and existing valid data are safe. */
export async function ensureWorkspaceAccountingFoundation(businessId: string, now = new Date()) {
  const checkingId = id(businessId, "checking");
  const entries = [
    ["1000", "Business Checking", "ASSET", "BANK", "DEBIT", checkingId],
    ["3000", "Owner Contributions", "EQUITY", "OWNER_CONTRIBUTION", "CREDIT", null],
    ["3100", "Owner Distributions", "EQUITY", "OWNER_DISTRIBUTION", "DEBIT", null],
    ["4000", "Business Income", "INCOME", "COMMISSION_INCOME", "CREDIT", null],
    ["5100", "Office Supplies Expense", "EXPENSE", "OFFICE_SUPPLIES_EXPENSE", "DEBIT", null],
    ["5200", "Payroll Expense", "EXPENSE", "PAYROLL_EXPENSE", "DEBIT", null],
    ["5210", "Employer Payroll Tax Expense", "EXPENSE", "PAYROLL_TAX_EXPENSE", "DEBIT", null],
    ["5300", "Professional Fees Expense", "EXPENSE", "PROFESSIONAL_FEES_EXPENSE", "DEBIT", null],
    ["5900", "Other Business Expense", "EXPENSE", "OTHER_EXPENSE", "DEBIT", null],
    ["2100", "Payroll Tax Payable", "LIABILITY", "PAYROLL_TAX_PAYABLE", "CREDIT", null],
    ["2200", "Reimbursement Payable", "LIABILITY", "REIMBURSEMENT_PAYABLE", "CREDIT", null],
    ["2500", "Shareholder Loan Payable", "LIABILITY", "LONG_TERM_LIABILITY", "CREDIT", null],
    ["1500", "Fixed Assets", "ASSET", "FIXED_ASSET", "DEBIT", null],
  ] as const;
  const periodStart = startOfYear(now);
  await prisma.$transaction([
    prisma.financialAccount.upsert({
      where: { id: checkingId },
      create: { id: checkingId, businessId, name: "Business Checking", type: "CHECKING", ownership: "BUSINESS", openedAt: now },
      update: {},
    }),
    ...entries.map(([code, name, type, subtype, normalBalance, financialAccountId]) =>
      prisma.ledgerAccount.upsert({
        where: { businessId_code: { businessId, code } },
        create: { id: id(businessId, code), businessId, code, name, type, subtype, normalBalance, isSystem: true, financialAccountId },
        update: {},
      }),
    ),
    prisma.accountingPeriod.upsert({
      where: { businessId_startsAt_endsAt: { businessId, startsAt: periodStart, endsAt: endOfYear(now) } },
      create: { id: id(businessId, `period-${now.getUTCFullYear()}`), businessId, startsAt: periodStart, endsAt: endOfYear(now), status: "OPEN" },
      update: {},
    }),
  ]);
}
