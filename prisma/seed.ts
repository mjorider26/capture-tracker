import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type JournalEntrySourceType } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { requireSafeDemoDatabase } from "../scripts/demo-seed-safety";
import { restoreDemoMoneyBaseline } from "../scripts/demo-money-baseline";
import { verifyDemoSeed } from "../scripts/verify-demo-seed";

const databaseUrl = requireSafeDemoDatabase();
const prisma = createPrismaClient(databaseUrl);

const ids = {
  user: "demo-user-jordan-ellis",
  business: "demo-business-northstar-field-solutions",
  membership: "demo-membership-jordan-owner",
  checking: "demo-financial-account-business-checking",
  creditCard: "demo-financial-account-business-credit-card",
  personalCard: "demo-financial-account-personal-card",
  commission: "demo-transaction-commission-income",
  office: "demo-transaction-office-supplies",
  personal: "demo-transaction-personal-purchase",
  mixed: "demo-transaction-mixed-purpose",
  personallyPaid: "demo-transaction-personally-paid-expense",
  internet: "demo-transaction-internet-service",
  reimbursementPayment: "demo-transaction-reimbursement-payment",
  distribution: "demo-transaction-owner-distribution",
  pendingReview: "demo-transaction-pending-review",
  officeReceipt: "demo-document-office-receipt",
  julyStatement: "demo-document-july-statement",
  sharedClientReceipt: "demo-document-shared-client-receipt",
  unlinkedReceipt: "demo-document-unlinked-receipt",
  mixedBusinessSplit: "demo-split-mixed-business",
  mixedPersonalSplit: "demo-split-mixed-personal",
  claim: "demo-reimbursement-claim-july",
  reimbursementExpense: "demo-reimbursement-expense-july",
  payroll: "demo-payroll-run-july",
  ownerDistribution: "demo-owner-distribution-july",
  taxEstimate: "demo-quarterly-tax-estimate-q3",
  weeklyReview: "demo-weekly-review-july-20",
  period: "demo-accounting-period-july-2026",
  commissionEntry: "demo-journal-entry-commission",
  ordinaryExpenseEntry: "demo-journal-entry-ordinary-expenses",
  mixedEntry: "demo-journal-entry-mixed-purpose",
  reimbursementAccrualEntry: "demo-journal-entry-reimbursement-accrual",
  payrollEntry: "demo-journal-entry-payroll",
  distributionEntry: "demo-journal-entry-owner-distribution",
  reconciliation: "demo-reconciliation-business-checking-july-2026",
};

const ledger = {
  checking: "demo-ledger-1000-checking",
  creditCard: "demo-ledger-2000-credit-card",
  reimbursementPayable: "demo-ledger-2100-reimbursement-payable",
  payrollTaxPayable: "demo-ledger-2200-payroll-tax-payable",
  ownerDistributions: "demo-ledger-3100-owner-distributions",
  commissionIncome: "demo-ledger-4000-commission-income",
  officeSupplies: "demo-ledger-5100-office-supplies",
  internet: "demo-ledger-5200-internet-expense",
  professionalFees: "demo-ledger-5300-professional-fees",
  payrollExpense: "demo-ledger-5400-payroll-expense",
  payrollTaxExpense: "demo-ledger-5500-payroll-tax-expense",
};

const reviewTaskIds = [
  "demo-review-task-reconcile-checking",
  "demo-review-task-review-mixed",
  "demo-review-task-tax-reserve",
  "demo-review-task-payroll-liability",
  "demo-review-task-reimbursement-support",
];

const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

type SeedJournalEntry = {
  id: string;
  number: string;
  entryDate: string;
  description: string;
  sourceType: JournalEntrySourceType;
  sourceEntityId?: string;
  transactionId?: string;
  reimbursementClaimId?: string;
  payrollRunId?: string;
  ownerDistributionId?: string;
  lines: Array<[string, string, string]>;
};

async function existingDemoRecordCount(): Promise<number> {
  const [users, businesses, entries] = await Promise.all([
    prisma.user.count({ where: { id: ids.user } }),
    prisma.business.count({ where: { id: ids.business } }),
    prisma.journalEntry.count({
      where: {
        id: {
          in: Object.values(ids).filter((id) => id.includes("journal-entry")),
        },
      },
    }),
  ]);

  return users + businesses + entries;
}

async function assertNoUnexpectedDevelopmentData(): Promise<void> {
  const [userCount, businessCount, credentialCount] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.account.count(),
  ]);

  if (userCount !== 0 || businessCount !== 0 || credentialCount !== 0) {
    throw new Error(
      "Demo seed is blocked because the local development database contains unexpected identity or credential data.",
    );
  }
}

async function restoreDemoDocumentLinks(): Promise<void> {
  const documents = [
    [ids.officeReceipt, "field-office-supplies-receipt.pdf", "Field office supplies receipt", "RECEIPT", "RECEIPT", "2026-07-05", "1"],
    [ids.julyStatement, "northstar-july-statement.pdf", "July business checking statement", "BANK_STATEMENT", "BANK_STATEMENT", "2026-07-31", "2"],
    [ids.sharedClientReceipt, "client-site-travel-receipt.pdf", "Client-site travel receipt", "RECEIPT", "RECEIPT", "2026-07-10", "3"],
    [ids.unlinkedReceipt, "unfiled-field-receipt.pdf", "Unfiled field receipt", "RECEIPT", "RECEIPT", "2026-07-19", "4"],
  ] as const;
  await prisma.$transaction(async (tx) => {
    for (const [id, originalFilename, displayName, type, category, documentDate, suffix] of documents) {
      await tx.document.upsert({
        where: { id },
        create: {
          id, businessId: ids.business, uploadedByMembershipId: ids.user,
          storageKey: `fictional-demo-document-${suffix}`,
          originalFilename, displayName, mimeType: "application/pdf", detectedMimeType: "application/pdf",
          sizeBytes: BigInt(2048), storedSizeBytes: BigInt(2048), sha256: suffix.repeat(64), type, category,
          status: "ACTIVE", storageState: "STORED_PRIVATE", storageProvider: "fictional-demo",
          uploadCompletedAt: date(documentDate), privateReadEligible: true, documentDate: date(documentDate),
          malwareScanStatus: "CLEAN", malwareScanProvider: "fictional-demo", malwareScannedAt: date(documentDate),
          retentionClass: "GENERAL_TAX_SEVEN_YEARS", retentionUntil: date("2033-12-31"), activatedAt: date(documentDate),
        },
        update: { displayName, originalFilename, category, type, storageKey: `fictional-demo-document-${suffix}`, status: "ACTIVE", storageState: "STORED_PRIVATE", privateReadEligible: true, malwareScanStatus: "CLEAN", deletedAt: null },
      });
      await tx.documentStatusHistory.upsert({
        where: { id: `demo-document-status-${suffix}` },
        create: { id: `demo-document-status-${suffix}`, businessId: ids.business, documentId: id, newStatus: "ACTIVE", actorUserId: ids.user, note: "Fictional deterministic demo document." },
        update: {},
      });
    }
    const links = [
      ["demo-link-office-receipt-old", ids.office, ids.officeReceipt, "2026-07-05", "2026-07-06"],
      ["demo-link-office-receipt-current", ids.office, ids.officeReceipt, "2026-07-07", null],
      ["demo-link-internet-statement", ids.internet, ids.julyStatement, "2026-07-12", null],
      ["demo-link-internet-shared-receipt", ids.internet, ids.sharedClientReceipt, "2026-07-12", null],
      ["demo-link-personally-paid-shared-receipt", ids.personallyPaid, ids.sharedClientReceipt, "2026-07-10", null],
    ] as const;
    for (const [id, transactionId, documentId, attached, unlinked] of links) {
      await tx.transactionDocument.upsert({
        where: { id },
        create: { id, businessId: ids.business, transactionId, documentId, attachedAt: date(attached), linkedByUserId: ids.user, unlinkedAt: unlinked ? date(unlinked) : null, unlinkedByUserId: unlinked ? ids.user : null, unlinkReason: unlinked ? "Fictional demo relink." : null },
        update: { unlinkedAt: unlinked ? date(unlinked) : null, unlinkedByUserId: unlinked ? ids.user : null, unlinkReason: unlinked ? "Fictional demo relink." : null },
      });
      await tx.transactionDocumentHistory.upsert({
        where: { id: `demo-history-linked-${id}` },
        create: { id: `demo-history-linked-${id}`, businessId: ids.business, transactionDocumentId: id, action: "LINKED", actorUserId: ids.user, createdAt: date(attached) },
        update: {},
      });
      if (unlinked) await tx.transactionDocumentHistory.upsert({
        where: { id: `demo-history-unlinked-${id}` },
        create: { id: `demo-history-unlinked-${id}`, businessId: ids.business, transactionDocumentId: id, action: "UNLINKED", actorUserId: ids.user, note: "Fictional demo relink.", createdAt: date(unlinked) },
        update: {},
      });
    }
  });
  const activeRoot = join(process.cwd(), ".document-storage", "active");
  await mkdir(activeRoot, { recursive: true });
  await Promise.all(["1", "2", "3", "4"].map(async (suffix) => {
    try { await writeFile(join(activeRoot, `fictional-demo-document-${suffix}`), "%PDF-1.4\n% fictional Capture Tracker extraction fixture\n", { flag: "wx" }); }
    catch (error) { if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) throw error; }
  }));
}

async function seed(): Promise<void> {
  const existingCount = await existingDemoRecordCount();
  if (existingCount > 0) {
    await restoreDemoMoneyBaseline(prisma);
    await restoreDemoDocumentLinks();
    await verifyDemoSeed(prisma);
    console.log(
      "Restored the mutable deterministic Money baseline and verified demo data.",
    );
    return;
  }

  await assertNoUnexpectedDevelopmentData();

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: ids.user,
        email: "jordan.ellis@northstar.demo",
        displayName: "Jordan Ellis",
        emailVerified: false,
      },
    });

    await tx.business.create({
      data: {
        id: ids.business,
        legalName: "Northstar Field Solutions, Inc.",
        displayName: "Northstar Field Solutions",
        timezone: "America/Los_Angeles",
        currency: "USD",
      },
    });

    await tx.businessMember.create({
      data: {
        id: ids.membership,
        businessId: ids.business,
        userId: ids.user,
        role: "OWNER",
      },
    });

    await tx.businessOnboarding.create({
      data: {
        businessId: ids.business,
        actorUserId: ids.user,
        ownerDisplayName: "Jordan Ellis",
        fictionalAcknowledged: true,
        chartConfirmed: true,
        status: "COMPLETED",
        completedAt: date("2026-07-01"),
      },
    });

    await tx.financialAccount.createMany({
      data: [
        {
          id: ids.checking,
          businessId: ids.business,
          name: "Business checking",
          institutionName: "Northstar Community Bank",
          type: "CHECKING",
          ownership: "BUSINESS",
          lastFour: "1001",
          openingBalance: "0.00",
          openedAt: date("2026-07-01"),
        },
        {
          id: ids.creditCard,
          businessId: ids.business,
          name: "Business credit card",
          institutionName: "Northstar Community Bank",
          type: "CREDIT_CARD",
          ownership: "BUSINESS",
          lastFour: "2002",
          openingBalance: "0.00",
          openedAt: date("2026-07-01"),
        },
        {
          id: ids.personalCard,
          businessId: ids.business,
          name: "Personally owned card",
          institutionName: "Fictional Card Services",
          type: "PERSONAL_CARD",
          ownership: "PERSONAL",
          lastFour: "3003",
          openingBalance: "0.00",
          openedAt: date("2026-07-01"),
        },
      ],
    });

    await tx.transaction.createMany({
      data: [
        {
          id: ids.commission,
          businessId: ids.business,
          accountId: ids.checking,
          postedAt: date("2026-07-03"),
          description: "July field-services commission",
          merchantName: "Fictional Marketplace",
          amount: "5000.00",
          direction: "INFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-commission-2026-07",
          approvedAt: date("2026-07-03"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.office,
          businessId: ids.business,
          accountId: ids.creditCard,
          postedAt: date("2026-07-05"),
          description: "Field office supplies",
          merchantName: "Fictional Office Supply",
          amount: "240.00",
          direction: "OUTFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-office-2026-07",
          approvedAt: date("2026-07-05"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.personal,
          businessId: ids.business,
          accountId: ids.personalCard,
          postedAt: date("2026-07-06"),
          description: "Personal household purchase",
          merchantName: "Fictional Home Store",
          amount: "85.00",
          direction: "OUTFLOW",
          intent: "PERSONAL",
          status: "EXCLUDED",
          sourceReference: "demo-personal-2026-07",
        },
        {
          id: ids.mixed,
          businessId: ids.business,
          accountId: ids.personalCard,
          postedAt: date("2026-07-08"),
          description: "Mixed field and personal supplies",
          merchantName: "Fictional General Store",
          amount: "150.00",
          direction: "OUTFLOW",
          intent: "MIXED",
          status: "APPROVED",
          sourceReference: "demo-mixed-2026-07",
          approvedAt: date("2026-07-08"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.personallyPaid,
          businessId: ids.business,
          accountId: ids.personalCard,
          postedAt: date("2026-07-10"),
          description: "Personally paid client-site expense",
          merchantName: "Fictional Travel Services",
          amount: "300.00",
          direction: "OUTFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-personally-paid-2026-07",
          approvedAt: date("2026-07-10"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.internet,
          businessId: ids.business,
          accountId: ids.checking,
          postedAt: date("2026-07-12"),
          description: "Field operations internet service",
          merchantName: "Fictional Internet",
          amount: "450.00",
          direction: "OUTFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-internet-2026-07",
          approvedAt: date("2026-07-12"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.reimbursementPayment,
          businessId: ids.business,
          accountId: ids.checking,
          postedAt: date("2026-07-15"),
          description: "Accountable-plan reimbursement payment",
          merchantName: "Jordan Ellis",
          amount: "300.00",
          direction: "OUTFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-reimbursement-payment-2026-07",
          approvedAt: date("2026-07-15"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.distribution,
          businessId: ids.business,
          accountId: ids.checking,
          postedAt: date("2026-07-18"),
          description: "Owner distribution",
          merchantName: "Jordan Ellis",
          amount: "700.00",
          direction: "OUTFLOW",
          intent: "BUSINESS",
          status: "APPROVED",
          sourceReference: "demo-distribution-2026-07",
          approvedAt: date("2026-07-18"),
          approvedByMembershipId: ids.user,
        },
        {
          id: ids.pendingReview,
          businessId: ids.business,
          accountId: ids.checking,
          postedAt: date("2026-07-20"),
          description: "Unreviewed field fuel purchase",
          merchantName: "Fictional Fuel Stop",
          amount: "125.00",
          direction: "OUTFLOW",
          intent: "UNREVIEWED",
          status: "PENDING_REVIEW",
          sourceReference: "demo-pending-review-2026-07",
        },
      ],
    });

    await tx.transactionSplit.createMany({
      data: [
        {
          id: ids.mixedBusinessSplit,
          businessId: ids.business,
          transactionId: ids.mixed,
          intent: "BUSINESS",
          amount: "120.00",
          memo: "Field-use supplies",
        },
        {
          id: ids.mixedPersonalSplit,
          businessId: ids.business,
          transactionId: ids.mixed,
          intent: "PERSONAL",
          amount: "30.00",
          memo: "Personal-use supplies",
        },
      ],
    });

    await tx.reimbursementClaim.create({
      data: {
        id: ids.claim,
        businessId: ids.business,
        claimantMembershipId: ids.user,
        status: "PAID",
        submittedAt: date("2026-07-11"),
        approvedAt: date("2026-07-12"),
        paidAt: date("2026-07-15"),
        totalAmount: "300.00",
        reimbursementAccountId: ids.checking,
        paymentTransactionId: ids.reimbursementPayment,
        notes:
          "Fictional accountable-plan reimbursement for client-site expense.",
      },
    });
    await tx.reimbursementExpense.create({
      data: {
        id: ids.reimbursementExpense,
        businessId: ids.business,
        claimId: ids.claim,
        expenseType: "OTHER",
        transactionId: ids.personallyPaid,
        incurredAt: date("2026-07-10"),
        amount: "300.00",
        businessPurpose:
          "Client-site travel and supplies for a fictional field-services engagement.",
        merchantName: "Fictional Travel Services",
      },
    });

    await tx.payrollRun.create({
      data: {
        id: ids.payroll,
        businessId: ids.business,
        payPeriodStart: date("2026-07-01"),
        payPeriodEnd: date("2026-07-15"),
        payDate: date("2026-07-16"),
        status: "PROCESSED",
        grossWages: "2000.00",
        employeeWithholding: "300.00",
        employeePayrollTax: "153.00",
        otherDeductions: "0.00",
        employerPayrollTax: "153.00",
        netPay: "1547.00",
        payrollProvider: "Fictional Payroll Service",
        externalReference: "demo-payroll-2026-07-16",
        processedAt: date("2026-07-16"),
      },
    });
    await tx.ownerDistribution.create({
      data: {
        id: ids.ownerDistribution,
        businessId: ids.business,
        distributionDate: date("2026-07-18"),
        amount: "700.00",
        status: "PAID",
        sourceAccountId: ids.checking,
        transactionId: ids.distribution,
        memo: "Fictional July owner distribution",
        approvedAt: date("2026-07-18"),
        paidAt: date("2026-07-18"),
      },
    });
    await tx.quarterlyTaxEstimate.create({
      data: {
        id: ids.taxEstimate,
        businessId: ids.business,
        taxYear: 2026,
        quarter: 3,
        jurisdictionType: "FEDERAL",
        jurisdictionCode: "US-IRS",
        status: "READY_FOR_REVIEW",
        projectedTaxLiability: "1800.00",
        safeHarborRequired: "1500.00",
        withholdingCredits: "300.00",
        priorPayments: "0.00",
        recommendedPayment: "1500.00",
        dueDate: date("2026-09-15"),
        assumptionsJson: {
          scenario: "fictional-demo",
          projectedQuarterlyCommission: "5000.00",
        },
        explanation:
          "Fictional Q3 planning estimate using a conservative safe-harbor target.",
        cpaReviewRecommended: true,
      },
    });
    await tx.weeklyReview.create({
      data: {
        id: ids.weeklyReview,
        businessId: ids.business,
        weekStart: date("2026-07-20"),
        weekEnd: date("2026-07-26"),
        status: "OPEN",
        estimatedCompletionMinutes: 25,
      },
    });
    await tx.reviewTask.createMany({
      data: [
        {
          id: reviewTaskIds[0],
          businessId: ids.business,
          weeklyReviewId: ids.weeklyReview,
          title: "Reconcile business checking activity",
          explanation:
            "Match July deposits and payments to the checking account.",
          category: "TRANSACTION_REVIEW",
          priority: "HIGH",
          sortOrder: 1,
        },
        {
          id: reviewTaskIds[1],
          businessId: ids.business,
          weeklyReviewId: ids.weeklyReview,
          title: "Review mixed-purpose split",
          explanation: "Confirm the $120 business and $30 personal allocation.",
          category: "TRANSACTION_REVIEW",
          priority: "HIGH",
          sortOrder: 2,
        },
        {
          id: reviewTaskIds[2],
          businessId: ids.business,
          weeklyReviewId: ids.weeklyReview,
          title: "Set aside the Q3 tax reserve",
          explanation:
            "Review the fictional federal estimated-tax recommendation.",
          category: "TAX_RESERVE",
          priority: "HIGH",
          sortOrder: 3,
        },
        {
          id: reviewTaskIds[3],
          businessId: ids.business,
          weeklyReviewId: ids.weeklyReview,
          title: "Schedule payroll-tax remittance",
          explanation:
            "Confirm the separately tracked payroll tax payable balance.",
          category: "PAYROLL",
          priority: "MEDIUM",
          sortOrder: 4,
        },
        {
          id: reviewTaskIds[4],
          businessId: ids.business,
          weeklyReviewId: ids.weeklyReview,
          title: "File reimbursement support",
          explanation:
            "Retain the fictional client-site expense support with the claim.",
          category: "REIMBURSEMENT",
          priority: "MEDIUM",
          sortOrder: 5,
        },
      ],
    });

    await tx.ledgerAccount.createMany({
      data: [
        {
          id: ledger.checking,
          businessId: ids.business,
          code: "1000",
          name: "Business Checking",
          type: "ASSET",
          subtype: "BANK",
          normalBalance: "DEBIT",
          isSystem: true,
          financialAccountId: ids.checking,
        },
        {
          id: ledger.creditCard,
          businessId: ids.business,
          code: "2000",
          name: "Business Credit Card",
          type: "LIABILITY",
          subtype: "CREDIT_CARD",
          normalBalance: "CREDIT",
          isSystem: true,
          financialAccountId: ids.creditCard,
        },
        {
          id: ledger.reimbursementPayable,
          businessId: ids.business,
          code: "2100",
          name: "Owner Reimbursement Payable",
          type: "LIABILITY",
          subtype: "REIMBURSEMENT_PAYABLE",
          normalBalance: "CREDIT",
          isSystem: true,
        },
        {
          id: ledger.payrollTaxPayable,
          businessId: ids.business,
          code: "2200",
          name: "Payroll Tax Payable",
          type: "LIABILITY",
          subtype: "PAYROLL_TAX_PAYABLE",
          normalBalance: "CREDIT",
          isSystem: true,
        },
        {
          id: ledger.ownerDistributions,
          businessId: ids.business,
          code: "3100",
          name: "Owner Distributions",
          type: "EQUITY",
          subtype: "OWNER_DISTRIBUTION",
          normalBalance: "DEBIT",
          isSystem: true,
        },
        {
          id: ledger.commissionIncome,
          businessId: ids.business,
          code: "4000",
          name: "Commission Income",
          type: "INCOME",
          subtype: "COMMISSION_INCOME",
          normalBalance: "CREDIT",
          isSystem: true,
        },
        {
          id: ledger.officeSupplies,
          businessId: ids.business,
          code: "5100",
          name: "Office Supplies Expense",
          type: "EXPENSE",
          subtype: "OFFICE_SUPPLIES_EXPENSE",
          normalBalance: "DEBIT",
          isSystem: true,
        },
        {
          id: ledger.internet,
          businessId: ids.business,
          code: "5200",
          name: "Internet Expense",
          type: "EXPENSE",
          subtype: "INTERNET_EXPENSE",
          normalBalance: "DEBIT",
          isSystem: true,
        },
        {
          id: ledger.professionalFees,
          businessId: ids.business,
          code: "5300",
          name: "Professional Fees Expense",
          type: "EXPENSE",
          subtype: "PROFESSIONAL_FEES_EXPENSE",
          normalBalance: "DEBIT",
          isSystem: true,
        },
        {
          id: ledger.payrollExpense,
          businessId: ids.business,
          code: "5400",
          name: "Payroll Expense",
          type: "EXPENSE",
          subtype: "PAYROLL_EXPENSE",
          normalBalance: "DEBIT",
          isSystem: true,
        },
        {
          id: ledger.payrollTaxExpense,
          businessId: ids.business,
          code: "5500",
          name: "Payroll Tax Expense",
          type: "EXPENSE",
          subtype: "PAYROLL_TAX_EXPENSE",
          normalBalance: "DEBIT",
          isSystem: true,
        },
      ],
    });
    await tx.accountingPeriod.create({
      data: {
        id: ids.period,
        businessId: ids.business,
        startsAt: date("2026-07-01"),
        endsAt: new Date("2026-07-31T23:59:59.999Z"),
        status: "OPEN",
      },
    });

    const entries: SeedJournalEntry[] = [
      {
        id: ids.commissionEntry,
        number: "DEMO-2026-07-001",
        entryDate: "2026-07-03",
        description: "Commission income received",
        sourceType: "BANK_TRANSACTION" as const,
        transactionId: ids.commission,
        lines: [
          [ledger.checking, "5000.00", "0.00"],
          [ledger.commissionIncome, "0.00", "5000.00"],
        ],
      },
      {
        id: ids.ordinaryExpenseEntry,
        number: "DEMO-2026-07-002",
        entryDate: "2026-07-12",
        description: "Ordinary July operating expenses",
        sourceType: "BANK_TRANSACTION" as const,
        transactionId: ids.office,
        lines: [
          [ledger.officeSupplies, "240.00", "0.00"],
          [ledger.internet, "450.00", "0.00"],
          [ledger.creditCard, "0.00", "240.00"],
          [ledger.checking, "0.00", "450.00"],
        ],
      },
      {
        id: ids.mixedEntry,
        number: "DEMO-2026-07-003",
        entryDate: "2026-07-08",
        description: "Business portion of mixed-purpose purchase",
        sourceType: "BANK_TRANSACTION" as const,
        transactionId: ids.mixed,
        lines: [
          [ledger.officeSupplies, "120.00", "0.00"],
          [ledger.reimbursementPayable, "0.00", "120.00"],
        ],
      },
      {
        id: ids.reimbursementAccrualEntry,
        number: "DEMO-2026-07-004",
        entryDate: "2026-07-15",
        description: "Accountable-plan reimbursement accrual and payment",
        sourceType: "REIMBURSEMENT_CLAIM" as const,
        reimbursementClaimId: ids.claim,
        lines: [
          [ledger.professionalFees, "300.00", "0.00"],
          [ledger.reimbursementPayable, "300.00", "0.00"],
          [ledger.reimbursementPayable, "0.00", "300.00"],
          [ledger.checking, "0.00", "300.00"],
        ],
      },
      {
        id: ids.payrollEntry,
        number: "DEMO-2026-07-005",
        entryDate: "2026-07-16",
        description: "July payroll run",
        sourceType: "PAYROLL_RUN" as const,
        payrollRunId: ids.payroll,
        lines: [
          [ledger.payrollExpense, "2000.00", "0.00"],
          [ledger.payrollTaxExpense, "153.00", "0.00"],
          [ledger.checking, "0.00", "1547.00"],
          [ledger.payrollTaxPayable, "0.00", "606.00"],
        ],
      },
      {
        id: ids.distributionEntry,
        number: "DEMO-2026-07-006",
        entryDate: "2026-07-18",
        description: "Owner distribution paid",
        sourceType: "OWNER_DISTRIBUTION" as const,
        transactionId: ids.distribution,
        ownerDistributionId: ids.ownerDistribution,
        lines: [
          [ledger.ownerDistributions, "700.00", "0.00"],
          [ledger.checking, "0.00", "700.00"],
        ],
      },
    ];

    for (const entry of entries) {
      await tx.journalEntry.create({
        data: {
          id: entry.id,
          businessId: ids.business,
          accountingPeriodId: ids.period,
          entryNumber: entry.number,
          entryDate: date(entry.entryDate),
          description: entry.description,
          status: "DRAFT",
          sourceType: entry.sourceType,
          sourceEntityId: entry.sourceEntityId,
          transactionId: entry.transactionId,
          reimbursementClaimId: entry.reimbursementClaimId,
          payrollRunId: entry.payrollRunId,
          ownerDistributionId: entry.ownerDistributionId,
        },
      });
      await tx.journalLine.createMany({
        data: entry.lines.map(
          ([ledgerAccountId, debitAmount, creditAmount], index) => ({
            id: `${entry.id}-line-${index + 1}`,
            businessId: ids.business,
            journalEntryId: entry.id,
            ledgerAccountId,
            lineNumber: index + 1,
            debitAmount,
            creditAmount,
          }),
        ),
      });
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: "POSTED", postedAt: date(entry.entryDate) },
      });
    }
    await tx.reconciliation.create({
      data: {
        id: ids.reconciliation,
        businessId: ids.business,
        financialAccountId: ids.checking,
        statementStartDate: date("2026-07-01"),
        statementEndDate: date("2026-07-31"),
        statementOpeningBalance: "0.00",
        statementEndingBalance: "3550.00",
        status: "DRAFT",
      },
    });
  });

  await restoreDemoDocumentLinks();

  await verifyDemoSeed(prisma);
  console.log(
    "Created and verified deterministic fictional demo data: no password, no Better Auth credential account, fictional records only, local target verified.",
  );
}

seed()
  .catch((error: unknown) => {
    console.error("Demo seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
