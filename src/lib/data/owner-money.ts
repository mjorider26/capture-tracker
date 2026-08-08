import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "../prisma";

const money = (value: Prisma.Decimal) => value.toFixed(2);

export async function getOwnerMoneyDashboard(businessId: string) {
  noStore();
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [claims, distributions, payrollRuns, contributionLines, loanLines, documents, transferCandidates, transfers, paymentCandidates] = await Promise.all([
    prisma.reimbursementClaim.findMany({ where: { businessId, status: { not: "VOIDED" } }, include: { expenses: { select: { businessPurpose: true, merchantName: true, documentId: true, incurredAt: true } }, paymentTransaction: { select: { id: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.ownerDistribution.findMany({ where: { businessId, status: { not: "VOIDED" }, distributionDate: { gte: yearStart } }, select: { id: true, amount: true, status: true, distributionDate: true, memo: true }, orderBy: { distributionDate: "desc" } }),
    prisma.payrollRun.aggregate({ where: { businessId, status: "PROCESSED", payDate: { gte: yearStart } }, _sum: { netPay: true } }),
    prisma.journalLine.findMany({ where: { businessId, journalEntry: { status: "POSTED", entryDate: { gte: yearStart } }, ledgerAccount: { subtype: "OWNER_CONTRIBUTION" } }, select: { debitAmount: true, creditAmount: true } }),
    prisma.journalLine.findMany({ where: { businessId, journalEntry: { status: "POSTED", entryDate: { gte: yearStart } }, ledgerAccount: { subtype: "LONG_TERM_LIABILITY" } }, select: { debitAmount: true, creditAmount: true, ledgerAccount: { select: { name: true } } } }),
    prisma.document.findMany({ where: { businessId, status: "ACTIVE", malwareScanStatus: "CLEAN" }, select: { id: true, originalFilename: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.externalTransaction.findMany({ where: { businessId, postedTransactionId: null, status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] }, ownerTransfer: null }, select: { id: true, description: true, amount: true, direction: true, transactionDate: true }, orderBy: { transactionDate: "desc" }, take: 30 }),
    prisma.ownerMoneyTransfer.findMany({ where: { businessId, status: "PENDING_REVIEW" }, select: { id: true, direction: true, classification: true, externalTransaction: { select: { description: true, amount: true } } }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.externalTransaction.findMany({ where: { businessId, postedTransactionId: null, direction: "OUTFLOW", status: { in: ["NEEDS_REVIEW", "SUGGESTED", "READY_TO_POST"] } }, select: { id: true, description: true, amount: true, transactionDate: true }, orderBy: { transactionDate: "desc" }, take: 100 }),
  ]);
  const sum = (lines: Array<{ debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }>) => lines.reduce((total, line) => total.plus(line.creditAmount).minus(line.debitAmount), new Prisma.Decimal(0));
  const dueClaims = claims.filter((claim) => ["DRAFT", "SUBMITTED", "NEEDS_INFORMATION", "APPROVED"].includes(claim.status));
  return {
    year: new Date().getUTCFullYear(),
    totals: {
      salary: money(payrollRuns._sum.netPay ?? new Prisma.Decimal(0)),
      distributions: money(distributions.reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0))),
      reimbursementsDue: money(dueClaims.reduce((total, item) => total.plus(item.totalAmount), new Prisma.Decimal(0))),
      contributions: money(sum(contributionLines)),
      longTermLiabilities: money(sum(loanLines)),
    },
    claims: claims.map((claim) => ({ id: claim.id, status: claim.status, totalAmount: money(claim.totalAmount), createdAt: claim.createdAt.toISOString(), paid: Boolean(claim.paymentTransaction), expense: claim.expenses[0] ? { purpose: claim.expenses[0].businessPurpose, merchant: claim.expenses[0].merchantName, hasDocument: Boolean(claim.expenses[0].documentId), incurredAt: claim.expenses[0].incurredAt.toISOString() } : null })),
    distributions: distributions.map((item) => ({ id: item.id, amount: money(item.amount), status: item.status, date: item.distributionDate.toISOString(), memo: item.memo })),
    documents,
    transferCandidates: transferCandidates.map((item) => ({ id: item.id, description: item.description, amount: money(item.amount), direction: item.direction, date: item.transactionDate.toISOString() })),
    paymentCandidates: paymentCandidates.map((item) => ({ id: item.id, description: item.description, amount: money(item.amount), date: item.transactionDate.toISOString() })),
    unresolvedTransfers: transfers.map((item) => ({ id: item.id, direction: item.direction, classification: item.classification, description: item.externalTransaction.description, amount: money(item.externalTransaction.amount) })),
  };
}
