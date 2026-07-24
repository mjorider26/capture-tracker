import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "../prisma";
import { paymentTotals } from "../services/tax-payment-core";

const money = (value: Prisma.Decimal) => value.toFixed(2);
const date = (value: Date | null) => (value ? value.toISOString() : null);

function total(values: Prisma.Decimal[]) {
  return values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
}

function safeHarborReadiness(estimate: {
  safeHarborRequired: Prisma.Decimal | null;
  withholdingCredits: Prisma.Decimal;
}) {
  if (estimate.safeHarborRequired) {
    return {
      title: "CPA estimate is authoritative",
      detail:
        "A stored CPA estimate is available. A formal safe-harbor test is unavailable because the CPA method and prior-year tax facts are not stored here.",
    };
  }

  return {
    title: "Current estimates available; formal safe-harbor test unavailable",
    detail: `No stored CPA method or prior-year tax is available. Recorded withholding is $${money(estimate.withholdingCredits)}.`,
  };
}

export async function getTaxesDashboard(businessId: string) {
  noStore();
  const [estimates, payrollRuns, distributions] = await Promise.all([
    prisma.quarterlyTaxEstimate.findMany({
      where: { businessId, status: { notIn: ["VOIDED", "SUPERSEDED"] } },
      include: { payments: { where: { status: "RECORDED" } } },
      orderBy: [{ taxYear: "desc" }, { quarter: "desc" }],
    }),
    prisma.payrollRun.findMany({
      where: { businessId, status: "PROCESSED" },
      select: {
        id: true,
        payPeriodStart: true,
        payPeriodEnd: true,
        payDate: true,
        grossWages: true,
        employeeWithholding: true,
        employerPayrollTax: true,
        netPay: true,
      },
      orderBy: { payDate: "desc" },
    }),
    prisma.ownerDistribution.findMany({
      where: { businessId, status: "PAID" },
      select: { id: true, distributionDate: true, amount: true, memo: true },
      orderBy: { distributionDate: "desc" },
    }),
  ]);

  const current = estimates[0] ?? null;
  const currentTotals = current
    ? paymentTotals(current.recommendedPayment, current.payments)
    : null;
  const reportingYear = current?.taxYear ?? null;
  const yearPayroll = reportingYear
    ? payrollRuns.filter(
        (run) => run.payDate.getUTCFullYear() === reportingYear,
      )
    : payrollRuns;
  const yearDistributions = reportingYear
    ? distributions.filter(
        (distribution) =>
          distribution.distributionDate.getUTCFullYear() === reportingYear,
      )
    : distributions;
  const payrollWages = total(yearPayroll.map((run) => run.grossWages));
  const distributionTotal = total(yearDistributions.map((item) => item.amount));

  return {
    estimates: estimates.map((estimate) => {
      const totals = paymentTotals(
        estimate.recommendedPayment,
        estimate.payments,
      );
      return {
        id: estimate.id,
        taxYear: estimate.taxYear,
        quarter: estimate.quarter,
        jurisdiction: estimate.jurisdictionCode,
        dueDate: date(estimate.dueDate),
        projected: money(estimate.recommendedPayment),
        paid: money(totals.paid),
        remaining: money(totals.remaining),
        version: estimate.version,
        status: estimate.status,
        cpaReviewRecommended: estimate.cpaReviewRecommended,
      };
    }),
    current:
      current && currentTotals
        ? {
            projected: money(current.recommendedPayment),
            paid: money(currentTotals.paid),
            remaining: money(currentTotals.remaining),
            dueDate: date(current.dueDate),
            readiness: safeHarborReadiness(current),
          }
        : null,
    reportingYear,
    payroll: {
      runs: payrollRuns.map((run) => ({
        id: run.id,
        payPeriodStart: date(run.payPeriodStart),
        payPeriodEnd: date(run.payPeriodEnd),
        payDate: date(run.payDate),
        grossWages: money(run.grossWages),
        withholding: money(run.employeeWithholding),
        employerPayrollTaxes: money(run.employerPayrollTax),
        netPay: money(run.netPay),
      })),
      count: yearPayroll.length,
      grossWages: money(payrollWages),
      withholding: money(
        total(yearPayroll.map((run) => run.employeeWithholding)),
      ),
      employerPayrollTaxes: money(
        total(yearPayroll.map((run) => run.employerPayrollTax)),
      ),
      netPay: money(total(yearPayroll.map((run) => run.netPay))),
      latestDate: date(payrollRuns[0]?.payDate ?? null),
    },
    distributions: {
      items: distributions.map((item) => ({
        id: item.id,
        date: date(item.distributionDate),
        amount: money(item.amount),
        memo: item.memo,
      })),
      count: yearDistributions.length,
      total: money(distributionTotal),
      latestDate: date(distributions[0]?.distributionDate ?? null),
    },
    ownerCompensation: {
      payrollWages: money(payrollWages),
      distributions: money(distributionTotal),
      combinedCash: money(payrollWages.plus(distributionTotal)),
      payrollRunCount: yearPayroll.length,
      distributionCount: yearDistributions.length,
      latestPayrollDate: date(payrollRuns[0]?.payDate ?? null),
      latestDistributionDate: date(distributions[0]?.distributionDate ?? null),
      missingFacts:
        "CPA review still needs owner duties, time devoted, comparable-market facts, and any shareholder-basis analysis. Those facts are not recorded here.",
    },
  };
}

export async function getTaxEstimateDetail(businessId: string, id: string) {
  noStore();
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(id)) return null;
  const estimate = await prisma.quarterlyTaxEstimate.findFirst({
    where: { id, businessId },
    include: {
      payments: {
        where: { status: "RECORDED" },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      },
    },
  });
  if (!estimate) return null;
  const totals = paymentTotals(estimate.recommendedPayment, estimate.payments);
  return {
    id: estimate.id,
    taxYear: estimate.taxYear,
    quarter: estimate.quarter,
    jurisdiction: estimate.jurisdictionCode,
    dueDate: date(estimate.dueDate),
    projected: money(estimate.recommendedPayment),
    paid: money(totals.paid),
    remaining: money(totals.remaining),
    version: estimate.version,
    status: estimate.status,
    payments: estimate.payments.map((payment) => ({
      amount: money(payment.amount),
      paidAt: date(payment.paidAt),
      recordedAt: date(payment.createdAt),
      reference: payment.confirmationNumber ?? payment.notes,
    })),
  };
}
