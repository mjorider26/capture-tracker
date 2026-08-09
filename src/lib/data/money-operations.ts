import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type MoneyOperationsSummary = {
  invoices: { openAmount: string; openCount: number; overdueCount: number };
  bills: { dueAmount: string; dueCount: number; upcomingCount: number };
  mileage: { milesThisYear: string; tripCount: number; unclaimedCount: number };
  bank: { connectionCount: number };
  cpa: { acceptedCount: number; pendingCount: number };
};

function money(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function total(items: Array<Prisma.Decimal>) {
  return items.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
}

export async function getMoneyOperationsSummary(
  businessId: string,
): Promise<MoneyOperationsSummary> {
  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const today = new Date();
  const [invoices, bills, mileage, connectionCount, pendingCount, acceptedCount] =
    await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, status: { notIn: ["DRAFT", "PAID", "VOID"] } },
        select: { total: true, status: true, dueDate: true, payments: { select: { amount: true } } },
      }),
      prisma.bill.findMany({
        where: { businessId, status: { notIn: ["DRAFT", "PAID", "VOID"] } },
        select: { total: true, dueDate: true, payments: { select: { amount: true } } },
      }),
      prisma.mileageTrip.findMany({
        where: { businessId, tripDate: { gte: startOfYear } },
        select: { miles: true, reimbursementClaimId: true },
      }),
      prisma.bankConnection.count({ where: { businessId } }),
      prisma.cpaInvitation.count({
        where: { businessId, status: "PENDING", expiresAt: { gt: today } },
      }),
      prisma.businessMember.count({ where: { businessId, role: "CPA_READ_ONLY" } }),
    ]);

  const invoiceOutstanding = invoices.map((invoice) =>
    invoice.total.minus(total(invoice.payments.map((payment) => payment.amount))),
  );
  const billOutstanding = bills.map((bill) =>
    bill.total.minus(total(bill.payments.map((payment) => payment.amount))),
  );
  const openInvoices = invoiceOutstanding.filter((amount) => amount.greaterThan(0));
  const openBills = billOutstanding.filter((amount) => amount.greaterThan(0));

  return {
    invoices: {
      openAmount: money(total(openInvoices)),
      openCount: openInvoices.length,
      overdueCount: invoices.filter(
        (invoice, index) =>
          invoiceOutstanding[index].greaterThan(0) &&
          (invoice.status === "OVERDUE" ||
            (invoice.dueDate !== null && invoice.dueDate < today)),
      ).length,
    },
    bills: {
      dueAmount: money(total(openBills)),
      dueCount: openBills.length,
      upcomingCount: bills.filter(
        (bill, index) =>
          billOutstanding[index].greaterThan(0) &&
          bill.dueDate !== null &&
          bill.dueDate >= today,
      ).length,
    },
    mileage: {
      milesThisYear: total(mileage.map((trip) => trip.miles)).toFixed(2),
      tripCount: mileage.length,
      unclaimedCount: mileage.filter((trip) => !trip.reimbursementClaimId).length,
    },
    bank: { connectionCount },
    cpa: { acceptedCount, pendingCount },
  };
}
