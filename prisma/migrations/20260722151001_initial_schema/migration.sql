-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BusinessRole" AS ENUM ('OWNER', 'ADVISOR');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'PERSONAL_CARD', 'CASH');

-- CreateEnum
CREATE TYPE "AccountOwnership" AS ENUM ('BUSINESS', 'PERSONAL');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "TransactionIntent" AS ENUM ('UNREVIEWED', 'BUSINESS', 'PERSONAL', 'MIXED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'EXCLUDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'BANK_STATEMENT', 'CREDIT_CARD_STATEMENT', 'PAYROLL_REPORT', 'TAX_FORM', 'REIMBURSEMENT_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_VALIDATION', 'ACTIVE', 'QUARANTINED', 'REJECTED', 'SUPERSEDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MalwareScanStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'CLEAN', 'INFECTED', 'UNSUPPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RetentionClass" AS ENUM ('GENERAL_TAX_SEVEN_YEARS', 'EMPLOYMENT_TAX_FOUR_YEARS', 'PERMANENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'APPROVE', 'REJECT', 'VOID', 'UPLOAD', 'VALIDATE', 'QUARANTINE', 'SUPERSEDE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerAccountSubtype" AS ENUM ('CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'OTHER_CURRENT_ASSET', 'FIXED_ASSET', 'CREDIT_CARD', 'ACCOUNTS_PAYABLE', 'PAYROLL_TAX_PAYABLE', 'REIMBURSEMENT_PAYABLE', 'OTHER_CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'OWNER_CONTRIBUTION', 'OWNER_DISTRIBUTION', 'RETAINED_EARNINGS', 'COMMISSION_INCOME', 'OTHER_INCOME', 'TRAVEL_EXPENSE', 'MEALS_EXPENSE', 'LODGING_EXPENSE', 'MILEAGE_EXPENSE', 'PHONE_EXPENSE', 'INTERNET_EXPENSE', 'OFFICE_SUPPLIES_EXPENSE', 'PAYROLL_EXPENSE', 'PAYROLL_TAX_EXPENSE', 'PROFESSIONAL_FEES_EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'REVERSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "JournalEntrySourceType" AS ENUM ('MANUAL', 'BANK_TRANSACTION', 'REIMBURSEMENT_CLAIM', 'REIMBURSEMENT_PAYMENT', 'PAYROLL_RUN', 'OWNER_DISTRIBUTION', 'TAX_PAYMENT', 'OPENING_BALANCE', 'ADJUSTING_ENTRY', 'REVERSING_ENTRY');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'SOFT_CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReconciliationItemStatus" AS ENUM ('OUTSTANDING', 'CLEARED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "PostingRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PostingRuleSourceType" AS ENUM ('TRANSACTION_INTENT', 'REIMBURSEMENT_EXPENSE', 'PAYROLL_RUN', 'OWNER_DISTRIBUTION', 'TAX_PAYMENT');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_INFORMATION', 'APPROVED', 'REJECTED', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReimbursementExpenseType" AS ENUM ('MILEAGE', 'AIRFARE', 'LODGING', 'MEALS', 'PARKING', 'TOLLS', 'SUPPLIES', 'PHONE', 'INTERNET', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "TaxEstimateStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUPERSEDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TaxPaymentStatus" AS ENUM ('PLANNED', 'RECORDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "TaxJurisdictionType" AS ENUM ('FEDERAL', 'STATE', 'LOCAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewTaskCategory" AS ENUM ('RECEIPT', 'TRANSACTION_REVIEW', 'TAX_RESERVE', 'PAYROLL', 'QUARTERLY_TAX', 'REIMBURSEMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReviewTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AIRecommendationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AIRecommendationType" AS ENUM ('TRANSACTION_INTENT', 'TRANSACTION_SPLIT', 'DOCUMENT_MATCH', 'REIMBURSEMENT_ELIGIBILITY', 'TAX_RESERVE', 'QUARTERLY_ESTIMATE', 'PAYROLL_REVIEW', 'DISTRIBUTION_REVIEW', 'GENERAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "einLastFour" TEXT,
    "taxElection" TEXT NOT NULL DEFAULT 'S_CORP',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BusinessRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BusinessMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionName" TEXT,
    "type" "AccountType" NOT NULL,
    "ownership" "AccountOwnership" NOT NULL,
    "lastFour" TEXT,
    "isTaxReserve" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "merchantName" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "intent" "TransactionIntent" NOT NULL DEFAULT 'UNREVIEWED',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "sourceReference" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionSplit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "intent" "TransactionIntent" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TransactionSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "uploadedByMembershipId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "detectedMimeType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "malwareScanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "malwareScanProvider" TEXT DEFAULT 'AWS_GUARDDUTY_S3',
    "malwareScannedAt" TIMESTAMP(3),
    "validationError" TEXT,
    "retentionClass" "RetentionClass" NOT NULL,
    "retentionUntil" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionDocument" (
    "businessId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TransactionDocument_pkey" PRIMARY KEY ("businessId","transactionId","documentId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "actorMembershipId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadataJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementClaim" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "claimantMembershipId" TEXT NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reimbursementAccountId" TEXT,
    "paymentTransactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReimbursementExpense" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "expenseType" "ReimbursementExpenseType" NOT NULL,
    "transactionId" TEXT,
    "documentId" TEXT,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "businessPurpose" TEXT NOT NULL,
    "merchantName" TEXT,
    "attendees" TEXT,
    "tripOrigin" TEXT,
    "tripDestination" TEXT,
    "mileageMiles" DECIMAL(10,2),
    "mileageRate" DECIMAL(8,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReimbursementExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "payPeriodStart" TIMESTAMP(3) NOT NULL,
    "payPeriodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "grossWages" DECIMAL(18,2) NOT NULL,
    "employeeWithholding" DECIMAL(18,2) NOT NULL,
    "employeePayrollTax" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "employerPayrollTax" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "payrollProvider" TEXT,
    "externalReference" TEXT,
    "documentId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerDistribution" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "distributionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceAccountId" TEXT NOT NULL,
    "transactionId" TEXT,
    "memo" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OwnerDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterlyTaxEstimate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "jurisdictionType" "TaxJurisdictionType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "status" "TaxEstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "projectedTaxLiability" DECIMAL(18,2) NOT NULL,
    "safeHarborRequired" DECIMAL(18,2),
    "withholdingCredits" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "priorPayments" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "recommendedPayment" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "assumptionsJson" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "cpaReviewRecommended" BOOLEAN NOT NULL DEFAULT false,
    "supersedesEstimateId" TEXT,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "QuarterlyTaxEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxPaymentRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "estimateId" TEXT,
    "jurisdictionType" "TaxJurisdictionType" NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "TaxPaymentStatus" NOT NULL DEFAULT 'PLANNED',
    "paidAt" TIMESTAMP(3),
    "confirmationNumber" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TaxPaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "estimatedCompletionMinutes" INTEGER NOT NULL DEFAULT 10,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "weeklyReviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT,
    "category" "ReviewTaskCategory" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ReviewTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "sourceType" TEXT,
    "sourceEntityId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" "AIRecommendationType" NOT NULL,
    "status" "AIRecommendationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "proposedChangeJson" JSONB NOT NULL,
    "supportingFactsJson" JSONB,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerMembershipId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "reason" TEXT,
    "expectedEntityVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reimbursementClaimId" TEXT,
    "payrollRunId" TEXT,
    "ownerDistributionId" TEXT,
    "quarterlyTaxEstimateId" TEXT,
    "aiRecommendationId" TEXT,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "LedgerAccountType" NOT NULL,
    "subtype" "LedgerAccountSubtype" NOT NULL,
    "normalBalance" "NormalBalance" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "financialAccountId" TEXT,
    "parentAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" "JournalEntrySourceType" NOT NULL,
    "sourceEntityId" TEXT,
    "transactionId" TEXT,
    "reimbursementClaimId" TEXT,
    "payrollRunId" TEXT,
    "ownerDistributionId" TEXT,
    "taxPaymentRecordId" TEXT,
    "reversalOfEntryId" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "approvedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "memo" TEXT,
    "debitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PostingRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceType" "PostingRuleSourceType" NOT NULL,
    "sourceSubtype" TEXT,
    "debitLedgerAccountId" TEXT NOT NULL,
    "creditLedgerAccountId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PostingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "statementStartDate" TIMESTAMP(3) NOT NULL,
    "statementEndDate" TIMESTAMP(3) NOT NULL,
    "statementOpeningBalance" DECIMAL(18,2) NOT NULL,
    "statementEndingBalance" DECIMAL(18,2) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "completedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "ReconciliationItemStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Business_legalName_idx" ON "Business"("legalName");

-- CreateIndex
CREATE INDEX "BusinessMember_userId_idx" ON "BusinessMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMember_businessId_userId_key" ON "BusinessMember"("businessId", "userId");

-- CreateIndex
CREATE INDEX "FinancialAccount_businessId_isActive_idx" ON "FinancialAccount"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "FinancialAccount_businessId_type_idx" ON "FinancialAccount"("businessId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_businessId_id_key" ON "FinancialAccount"("businessId", "id");

-- CreateIndex
CREATE INDEX "Transaction_businessId_postedAt_idx" ON "Transaction"("businessId", "postedAt");

-- CreateIndex
CREATE INDEX "Transaction_businessId_status_idx" ON "Transaction"("businessId", "status");

-- CreateIndex
CREATE INDEX "Transaction_businessId_intent_idx" ON "Transaction"("businessId", "intent");

-- CreateIndex
CREATE INDEX "Transaction_businessId_accountId_postedAt_idx" ON "Transaction"("businessId", "accountId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_businessId_id_key" ON "Transaction"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_sourceReference_key" ON "Transaction"("accountId", "sourceReference");

-- CreateIndex
CREATE INDEX "TransactionSplit_businessId_transactionId_idx" ON "TransactionSplit"("businessId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSplit_businessId_id_key" ON "TransactionSplit"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_businessId_sha256_idx" ON "Document"("businessId", "sha256");

-- CreateIndex
CREATE INDEX "Document_businessId_status_idx" ON "Document"("businessId", "status");

-- CreateIndex
CREATE INDEX "Document_businessId_type_idx" ON "Document"("businessId", "type");

-- CreateIndex
CREATE INDEX "Document_retentionUntil_idx" ON "Document"("retentionUntil");

-- CreateIndex
CREATE INDEX "Document_malwareScanStatus_idx" ON "Document"("malwareScanStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Document_businessId_id_key" ON "Document"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_businessId_replacedById_key" ON "Document"("businessId", "replacedById");

-- CreateIndex
CREATE INDEX "TransactionDocument_businessId_documentId_idx" ON "TransactionDocument"("businessId", "documentId");

-- CreateIndex
CREATE INDEX "AuditEvent_businessId_occurredAt_idx" ON "AuditEvent"("businessId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_businessId_entityType_entityId_idx" ON "AuditEvent"("businessId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorMembershipId_occurredAt_idx" ON "AuditEvent"("actorMembershipId", "occurredAt");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_businessId_status_idx" ON "ReimbursementClaim"("businessId", "status");

-- CreateIndex
CREATE INDEX "ReimbursementClaim_businessId_submittedAt_idx" ON "ReimbursementClaim"("businessId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementClaim_businessId_id_key" ON "ReimbursementClaim"("businessId", "id");

-- CreateIndex
CREATE INDEX "ReimbursementExpense_businessId_claimId_idx" ON "ReimbursementExpense"("businessId", "claimId");

-- CreateIndex
CREATE INDEX "ReimbursementExpense_businessId_transactionId_idx" ON "ReimbursementExpense"("businessId", "transactionId");

-- CreateIndex
CREATE INDEX "ReimbursementExpense_businessId_documentId_idx" ON "ReimbursementExpense"("businessId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementExpense_businessId_id_key" ON "ReimbursementExpense"("businessId", "id");

-- CreateIndex
CREATE INDEX "PayrollRun_businessId_payDate_idx" ON "PayrollRun"("businessId", "payDate");

-- CreateIndex
CREATE INDEX "PayrollRun_businessId_status_idx" ON "PayrollRun"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_businessId_id_key" ON "PayrollRun"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_businessId_externalReference_key" ON "PayrollRun"("businessId", "externalReference");

-- CreateIndex
CREATE INDEX "OwnerDistribution_businessId_distributionDate_idx" ON "OwnerDistribution"("businessId", "distributionDate");

-- CreateIndex
CREATE INDEX "OwnerDistribution_businessId_status_idx" ON "OwnerDistribution"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerDistribution_businessId_id_key" ON "OwnerDistribution"("businessId", "id");

-- CreateIndex
CREATE INDEX "QuarterlyTaxEstimate_businessId_dueDate_idx" ON "QuarterlyTaxEstimate"("businessId", "dueDate");

-- CreateIndex
CREATE INDEX "QuarterlyTaxEstimate_businessId_status_idx" ON "QuarterlyTaxEstimate"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyTaxEstimate_businessId_id_key" ON "QuarterlyTaxEstimate"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyTaxEstimate_businessId_taxYear_quarter_jurisdictio_key" ON "QuarterlyTaxEstimate"("businessId", "taxYear", "quarter", "jurisdictionType", "jurisdictionCode", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyTaxEstimate_businessId_supersedesEstimateId_key" ON "QuarterlyTaxEstimate"("businessId", "supersedesEstimateId");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_businessId_taxYear_quarter_idx" ON "TaxPaymentRecord"("businessId", "taxYear", "quarter");

-- CreateIndex
CREATE INDEX "TaxPaymentRecord_businessId_status_idx" ON "TaxPaymentRecord"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TaxPaymentRecord_businessId_id_key" ON "TaxPaymentRecord"("businessId", "id");

-- CreateIndex
CREATE INDEX "WeeklyReview_businessId_status_idx" ON "WeeklyReview"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_businessId_id_key" ON "WeeklyReview"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_businessId_weekStart_key" ON "WeeklyReview"("businessId", "weekStart");

-- CreateIndex
CREATE INDEX "ReviewTask_businessId_weeklyReviewId_status_idx" ON "ReviewTask"("businessId", "weeklyReviewId", "status");

-- CreateIndex
CREATE INDEX "ReviewTask_businessId_priority_idx" ON "ReviewTask"("businessId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_businessId_id_key" ON "ReviewTask"("businessId", "id");

-- CreateIndex
CREATE INDEX "AIRecommendation_businessId_status_idx" ON "AIRecommendation"("businessId", "status");

-- CreateIndex
CREATE INDEX "AIRecommendation_businessId_type_idx" ON "AIRecommendation"("businessId", "type");

-- CreateIndex
CREATE INDEX "AIRecommendation_businessId_sourceEntityType_sourceEntityId_idx" ON "AIRecommendation"("businessId", "sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "AIRecommendation_businessId_id_key" ON "AIRecommendation"("businessId", "id");

-- CreateIndex
CREATE INDEX "ApprovalDecision_businessId_status_idx" ON "ApprovalDecision"("businessId", "status");

-- CreateIndex
CREATE INDEX "ApprovalDecision_businessId_reviewerMembershipId_idx" ON "ApprovalDecision"("businessId", "reviewerMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalDecision_businessId_id_key" ON "ApprovalDecision"("businessId", "id");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_type_isActive_idx" ON "LedgerAccount"("businessId", "type", "isActive");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_parentAccountId_idx" ON "LedgerAccount"("businessId", "parentAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_businessId_id_key" ON "LedgerAccount"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_businessId_code_key" ON "LedgerAccount"("businessId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_businessId_financialAccountId_key" ON "LedgerAccount"("businessId", "financialAccountId");

-- CreateIndex
CREATE INDEX "AccountingPeriod_businessId_status_idx" ON "AccountingPeriod"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_businessId_id_key" ON "AccountingPeriod"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_businessId_startsAt_endsAt_key" ON "AccountingPeriod"("businessId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_entryDate_idx" ON "JournalEntry"("businessId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_status_idx" ON "JournalEntry"("businessId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_businessId_sourceType_sourceEntityId_idx" ON "JournalEntry"("businessId", "sourceType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_id_key" ON "JournalEntry"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_entryNumber_key" ON "JournalEntry"("businessId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_transactionId_key" ON "JournalEntry"("businessId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_reimbursementClaimId_key" ON "JournalEntry"("businessId", "reimbursementClaimId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_payrollRunId_key" ON "JournalEntry"("businessId", "payrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_ownerDistributionId_key" ON "JournalEntry"("businessId", "ownerDistributionId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_taxPaymentRecordId_key" ON "JournalEntry"("businessId", "taxPaymentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_businessId_reversalOfEntryId_key" ON "JournalEntry"("businessId", "reversalOfEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_businessId_ledgerAccountId_idx" ON "JournalLine"("businessId", "ledgerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_businessId_id_key" ON "JournalLine"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLine_businessId_journalEntryId_lineNumber_key" ON "JournalLine"("businessId", "journalEntryId", "lineNumber");

-- CreateIndex
CREATE INDEX "PostingRule_businessId_status_idx" ON "PostingRule"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRule_businessId_id_key" ON "PostingRule"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRule_businessId_sourceType_sourceSubtype_priority_key" ON "PostingRule"("businessId", "sourceType", "sourceSubtype", "priority");

-- CreateIndex
CREATE INDEX "Reconciliation_businessId_status_idx" ON "Reconciliation"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_businessId_id_key" ON "Reconciliation"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Reconciliation_businessId_financialAccountId_statementEndDa_key" ON "Reconciliation"("businessId", "financialAccountId", "statementEndDate");

-- CreateIndex
CREATE INDEX "ReconciliationItem_businessId_status_idx" ON "ReconciliationItem"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationItem_businessId_id_key" ON "ReconciliationItem"("businessId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationItem_businessId_reconciliationId_transactionI_key" ON "ReconciliationItem"("businessId", "reconciliationId", "transactionId");

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMember" ADD CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_accountId_fkey" FOREIGN KEY ("businessId", "accountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_approvedByMembershipId_fkey" FOREIGN KEY ("businessId", "approvedByMembershipId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionSplit" ADD CONSTRAINT "TransactionSplit_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_uploadedByMembershipId_fkey" FOREIGN KEY ("businessId", "uploadedByMembershipId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_businessId_replacedById_fkey" FOREIGN KEY ("businessId", "replacedById") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionDocument" ADD CONSTRAINT "TransactionDocument_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_businessId_actorMembershipId_fkey" FOREIGN KEY ("businessId", "actorMembershipId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_businessId_claimantMembershipId_fkey" FOREIGN KEY ("businessId", "claimantMembershipId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_businessId_reimbursementAccountId_fkey" FOREIGN KEY ("businessId", "reimbursementAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_businessId_paymentTransactionId_fkey" FOREIGN KEY ("businessId", "paymentTransactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementExpense" ADD CONSTRAINT "ReimbursementExpense_businessId_claimId_fkey" FOREIGN KEY ("businessId", "claimId") REFERENCES "ReimbursementClaim"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementExpense" ADD CONSTRAINT "ReimbursementExpense_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementExpense" ADD CONSTRAINT "ReimbursementExpense_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReimbursementExpense" ADD CONSTRAINT "ReimbursementExpense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerDistribution" ADD CONSTRAINT "OwnerDistribution_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerDistribution" ADD CONSTRAINT "OwnerDistribution_businessId_sourceAccountId_fkey" FOREIGN KEY ("businessId", "sourceAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerDistribution" ADD CONSTRAINT "OwnerDistribution_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyTaxEstimate" ADD CONSTRAINT "QuarterlyTaxEstimate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyTaxEstimate" ADD CONSTRAINT "QuarterlyTaxEstimate_businessId_supersedesEstimateId_fkey" FOREIGN KEY ("businessId", "supersedesEstimateId") REFERENCES "QuarterlyTaxEstimate"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_businessId_estimateId_fkey" FOREIGN KEY ("businessId", "estimateId") REFERENCES "QuarterlyTaxEstimate"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxPaymentRecord" ADD CONSTRAINT "TaxPaymentRecord_businessId_documentId_fkey" FOREIGN KEY ("businessId", "documentId") REFERENCES "Document"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_businessId_weeklyReviewId_fkey" FOREIGN KEY ("businessId", "weeklyReviewId") REFERENCES "WeeklyReview"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_reviewerMembershipId_fkey" FOREIGN KEY ("businessId", "reviewerMembershipId") REFERENCES "BusinessMember"("businessId", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_reimbursementClaimId_fkey" FOREIGN KEY ("businessId", "reimbursementClaimId") REFERENCES "ReimbursementClaim"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_payrollRunId_fkey" FOREIGN KEY ("businessId", "payrollRunId") REFERENCES "PayrollRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_ownerDistributionId_fkey" FOREIGN KEY ("businessId", "ownerDistributionId") REFERENCES "OwnerDistribution"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_quarterlyTaxEstimateId_fkey" FOREIGN KEY ("businessId", "quarterlyTaxEstimateId") REFERENCES "QuarterlyTaxEstimate"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_businessId_aiRecommendationId_fkey" FOREIGN KEY ("businessId", "aiRecommendationId") REFERENCES "AIRecommendation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_businessId_parentAccountId_fkey" FOREIGN KEY ("businessId", "parentAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_accountingPeriodId_fkey" FOREIGN KEY ("businessId", "accountingPeriodId") REFERENCES "AccountingPeriod"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_reimbursementClaimId_fkey" FOREIGN KEY ("businessId", "reimbursementClaimId") REFERENCES "ReimbursementClaim"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_payrollRunId_fkey" FOREIGN KEY ("businessId", "payrollRunId") REFERENCES "PayrollRun"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_ownerDistributionId_fkey" FOREIGN KEY ("businessId", "ownerDistributionId") REFERENCES "OwnerDistribution"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_taxPaymentRecordId_fkey" FOREIGN KEY ("businessId", "taxPaymentRecordId") REFERENCES "TaxPaymentRecord"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_businessId_reversalOfEntryId_fkey" FOREIGN KEY ("businessId", "reversalOfEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_businessId_journalEntryId_fkey" FOREIGN KEY ("businessId", "journalEntryId") REFERENCES "JournalEntry"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_businessId_ledgerAccountId_fkey" FOREIGN KEY ("businessId", "ledgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_businessId_debitLedgerAccountId_fkey" FOREIGN KEY ("businessId", "debitLedgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRule" ADD CONSTRAINT "PostingRule_businessId_creditLedgerAccountId_fkey" FOREIGN KEY ("businessId", "creditLedgerAccountId") REFERENCES "LedgerAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_businessId_financialAccountId_fkey" FOREIGN KEY ("businessId", "financialAccountId") REFERENCES "FinancialAccount"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_businessId_reconciliationId_fkey" FOREIGN KEY ("businessId", "reconciliationId") REFERENCES "Reconciliation"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_businessId_transactionId_fkey" FOREIGN KEY ("businessId", "transactionId") REFERENCES "Transaction"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CAPTURE TRACKER CUSTOM DATABASE INTEGRITY BEGIN

-- ============================================================
-- BEGIN: split-integrity-trigger.sql
-- ============================================================
-- Enforce transaction split integrity.
-- This trigger rejects any committed split state whose total does not equal
-- the parent transaction amount when the transaction intent is MIXED.
--
-- It is DEFERRABLE so a server mutation can replace several split rows inside
-- one database transaction before validation occurs at COMMIT.

CREATE OR REPLACE FUNCTION assert_transaction_splits_sum_to_total()
RETURNS TRIGGER AS $$
DECLARE
  target_business_id TEXT;
  target_transaction_id TEXT;
  parent_amount NUMERIC(18,2);
  parent_intent "TransactionIntent";
  split_total NUMERIC(18,2);
BEGIN
  target_business_id := COALESCE(NEW."businessId", OLD."businessId");
  target_transaction_id := COALESCE(NEW."transactionId", OLD."transactionId");

  SELECT "amount", "intent"
    INTO parent_amount, parent_intent
  FROM "Transaction"
  WHERE "businessId" = target_business_id
    AND "id" = target_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent transaction not found for split validation';
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO split_total
  FROM "TransactionSplit"
  WHERE "businessId" = target_business_id
    AND "transactionId" = target_transaction_id;

  IF parent_intent = 'MIXED' AND split_total <> parent_amount THEN
    RAISE EXCEPTION
      'Transaction splits must sum to parent amount. transaction=%, expected=%, actual=%',
      target_transaction_id,
      parent_amount,
      split_total;
  END IF;

  IF parent_intent <> 'MIXED' AND split_total <> 0 THEN
    RAISE EXCEPTION
      'Non-mixed transactions cannot retain split rows. transaction=%',
      target_transaction_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER transaction_split_sum_matches_total
AFTER INSERT OR UPDATE OR DELETE ON "TransactionSplit"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_transaction_splits_sum_to_total();

-- Also validate when parent amount or intent changes.
CREATE OR REPLACE FUNCTION assert_parent_transaction_split_state()
RETURNS TRIGGER AS $$
DECLARE
  split_total NUMERIC(18,2);
BEGIN
  SELECT COALESCE(SUM("amount"), 0)
    INTO split_total
  FROM "TransactionSplit"
  WHERE "businessId" = NEW."businessId"
    AND "transactionId" = NEW."id";

  IF NEW."intent" = 'MIXED' AND split_total <> NEW."amount" THEN
    RAISE EXCEPTION
      'Transaction splits must sum to parent amount. transaction=%, expected=%, actual=%',
      NEW."id",
      NEW."amount",
      split_total;
  END IF;

  IF NEW."intent" <> 'MIXED' AND split_total <> 0 THEN
    RAISE EXCEPTION
      'Non-mixed transactions cannot retain split rows. transaction=%',
      NEW."id";
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER parent_transaction_split_state_is_valid
AFTER INSERT OR UPDATE OF "amount", "intent" ON "Transaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_parent_transaction_split_state();
-- ============================================================
-- END: split-integrity-trigger.sql
-- ============================================================

-- ============================================================
-- BEGIN: reimbursement-integrity-trigger.sql
-- ============================================================
-- Enforce reimbursement claim aggregate integrity.
-- This deferred constraint trigger allows a server mutation to insert, update,
-- delete, or replace multiple expense rows in one database transaction.
-- Validation occurs at COMMIT, after the mutation has reached its final state.

CREATE OR REPLACE FUNCTION assert_reimbursement_expenses_sum_to_claim_total()
RETURNS TRIGGER AS $$
DECLARE
  target_business_id TEXT;
  target_claim_id TEXT;
  claim_total NUMERIC(18,2);
  expense_total NUMERIC(18,2);
BEGIN
  target_business_id := COALESCE(NEW."businessId", OLD."businessId");
  target_claim_id := COALESCE(NEW."claimId", OLD."claimId");

  SELECT "totalAmount"
    INTO claim_total
  FROM "ReimbursementClaim"
  WHERE "businessId" = target_business_id
    AND "id" = target_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Parent reimbursement claim not found for expense validation. business=%, claim=%',
      target_business_id,
      target_claim_id;
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO expense_total
  FROM "ReimbursementExpense"
  WHERE "businessId" = target_business_id
    AND "claimId" = target_claim_id;

  IF expense_total <> claim_total THEN
    RAISE EXCEPTION
      'Reimbursement expenses must sum to claim total. claim=%, expected=%, actual=%',
      target_claim_id,
      claim_total,
      expense_total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER reimbursement_expense_sum_matches_claim_total
AFTER INSERT OR UPDATE OR DELETE ON "ReimbursementExpense"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_reimbursement_expenses_sum_to_claim_total();

-- Also validate when the parent claim total changes.
CREATE OR REPLACE FUNCTION assert_reimbursement_claim_total_matches_expenses()
RETURNS TRIGGER AS $$
DECLARE
  expense_total NUMERIC(18,2);
BEGIN
  SELECT COALESCE(SUM("amount"), 0)
    INTO expense_total
  FROM "ReimbursementExpense"
  WHERE "businessId" = NEW."businessId"
    AND "claimId" = NEW."id";

  IF expense_total <> NEW."totalAmount" THEN
    RAISE EXCEPTION
      'Reimbursement claim total must equal persisted expense total. claim=%, expected=%, actual=%',
      NEW."id",
      NEW."totalAmount",
      expense_total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER reimbursement_claim_total_matches_expenses
AFTER INSERT OR UPDATE OF "totalAmount" ON "ReimbursementClaim"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_reimbursement_claim_total_matches_expenses();
-- ============================================================
-- END: reimbursement-integrity-trigger.sql
-- ============================================================

-- ============================================================
-- BEGIN: final-hardening-constraints.sql
-- ============================================================
-- Final hardening constraints. Append to the first generated Prisma migration.

ALTER TABLE "Transaction"
  ADD CONSTRAINT "transaction_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "TransactionSplit"
  ADD CONSTRAINT "transaction_split_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "WeeklyReview"
  ADD CONSTRAINT "weekly_review_date_order" CHECK ("weekEnd" >= "weekStart");

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "payroll_period_date_order" CHECK ("payPeriodEnd" >= "payPeriodStart");

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "payroll_amounts_nonnegative" CHECK (
    "grossWages" >= 0 AND "employeeWithholding" >= 0
    AND "employeePayrollTax" >= 0 AND "otherDeductions" >= 0
    AND "employerPayrollTax" >= 0 AND "netPay" >= 0
  );

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "payroll_run_net_pay_consistent" CHECK (
    "netPay" = "grossWages" - "employeeWithholding"
      - "employeePayrollTax" - "otherDeductions"
  );

ALTER TABLE "QuarterlyTaxEstimate"
  ADD CONSTRAINT "quarterly_tax_estimate_quarter_range"
  CHECK ("quarter" BETWEEN 1 AND 4);

ALTER TABLE "QuarterlyTaxEstimate"
  ADD CONSTRAINT "quarterly_tax_estimate_revision_positive"
  CHECK ("revisionNumber" > 0);

ALTER TABLE "QuarterlyTaxEstimate"
  ADD CONSTRAINT "quarterly_tax_amounts_nonnegative" CHECK (
    "projectedTaxLiability" >= 0
    AND COALESCE("safeHarborRequired", 0) >= 0
    AND "withholdingCredits" >= 0
    AND "priorPayments" >= 0
    AND "recommendedPayment" >= 0
  );

ALTER TABLE "TaxPaymentRecord"
  ADD CONSTRAINT "tax_payment_quarter_range" CHECK ("quarter" BETWEEN 1 AND 4);

ALTER TABLE "TaxPaymentRecord"
  ADD CONSTRAINT "tax_payment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "ReimbursementClaim"
  ADD CONSTRAINT "reimbursement_claim_total_nonnegative" CHECK ("totalAmount" >= 0);

ALTER TABLE "ReimbursementExpense"
  ADD CONSTRAINT "reimbursement_expense_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "ReimbursementExpense"
  ADD CONSTRAINT "reimbursement_mileage_fields_consistent" CHECK (
    ("expenseType" = 'MILEAGE' AND "mileageMiles" IS NOT NULL
      AND "mileageMiles" > 0 AND "mileageRate" IS NOT NULL AND "mileageRate" > 0)
    OR
    ("expenseType" <> 'MILEAGE' AND "mileageMiles" IS NULL AND "mileageRate" IS NULL)
  );

ALTER TABLE "ApprovalDecision"
  ADD CONSTRAINT "approval_decision_exactly_one_target" CHECK (
    (CASE WHEN "reimbursementClaimId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "payrollRunId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "ownerDistributionId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "quarterlyTaxEstimateId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "aiRecommendationId" IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "audit_actor_type_consistent" CHECK (
    ("actorType" = 'USER' AND "actorMembershipId" IS NOT NULL)
    OR ("actorType" = 'SYSTEM' AND "actorMembershipId" IS NULL)
  );

-- ============================================================
-- END: final-hardening-constraints.sql
-- ============================================================

-- ============================================================
-- BEGIN: ledger-integrity-constraints.sql
-- ============================================================
-- Ledger Pass 1 integrity constraints and deferred validation triggers.

ALTER TABLE "LedgerAccount"
  ADD CONSTRAINT "ledger_account_code_not_blank"
  CHECK (length(trim("code")) > 0);

ALTER TABLE "LedgerAccount"
  ADD CONSTRAINT "ledger_account_name_not_blank"
  CHECK (length(trim("name")) > 0);

ALTER TABLE "AccountingPeriod"
  ADD CONSTRAINT "accounting_period_date_order"
  CHECK ("endsAt" >= "startsAt");

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "journal_line_one_sided_amount"
  CHECK (
    ("debitAmount" > 0 AND "creditAmount" = 0)
    OR
    ("creditAmount" > 0 AND "debitAmount" = 0)
  );

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "journal_line_number_positive"
  CHECK ("lineNumber" > 0);

ALTER TABLE "PostingRule"
  ADD CONSTRAINT "posting_rule_accounts_differ"
  CHECK ("debitLedgerAccountId" <> "creditLedgerAccountId");

ALTER TABLE "Reconciliation"
  ADD CONSTRAINT "reconciliation_statement_date_order"
  CHECK ("statementEndDate" >= "statementStartDate");

CREATE OR REPLACE FUNCTION assert_journal_entry_balanced()
RETURNS TRIGGER AS $$
DECLARE
  target_business_id TEXT;
  target_entry_id TEXT;
  debit_total NUMERIC(18,2);
  credit_total NUMERIC(18,2);
  entry_status "JournalEntryStatus";
BEGIN
  target_business_id := COALESCE(NEW."businessId", OLD."businessId");
  target_entry_id := COALESCE(NEW."journalEntryId", OLD."journalEntryId");

  SELECT "status"
    INTO entry_status
  FROM "JournalEntry"
  WHERE "businessId" = target_business_id
    AND "id" = target_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Parent journal entry not found. business=%, entry=%',
      target_business_id,
      target_entry_id;
  END IF;

  SELECT
    COALESCE(SUM("debitAmount"), 0),
    COALESCE(SUM("creditAmount"), 0)
  INTO debit_total, credit_total
  FROM "JournalLine"
  WHERE "businessId" = target_business_id
    AND "journalEntryId" = target_entry_id;

  IF entry_status IN ('PENDING_APPROVAL', 'POSTED', 'REVERSED') THEN
    IF debit_total = 0 OR credit_total = 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION
        'Journal entry must balance before approval or posting. entry=%, debits=%, credits=%',
        target_entry_id,
        debit_total,
        credit_total;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_lines_balance_parent_entry
AFTER INSERT OR UPDATE OR DELETE ON "JournalLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_journal_entry_balanced();

CREATE OR REPLACE FUNCTION assert_parent_journal_entry_balanced()
RETURNS TRIGGER AS $$
DECLARE
  debit_total NUMERIC(18,2);
  credit_total NUMERIC(18,2);
BEGIN
  SELECT
    COALESCE(SUM("debitAmount"), 0),
    COALESCE(SUM("creditAmount"), 0)
  INTO debit_total, credit_total
  FROM "JournalLine"
  WHERE "businessId" = NEW."businessId"
    AND "journalEntryId" = NEW."id";

  IF NEW."status" IN ('PENDING_APPROVAL', 'POSTED', 'REVERSED') THEN
    IF debit_total = 0 OR credit_total = 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION
        'Journal entry must balance before approval or posting. entry=%, debits=%, credits=%',
        NEW."id",
        debit_total,
        credit_total;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER parent_journal_entry_balance_valid
AFTER INSERT OR UPDATE OF "status" ON "JournalEntry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_parent_journal_entry_balanced();

-- Ensure a journal entry's date belongs to its assigned accounting period
-- and prevent posting into locked periods.
CREATE OR REPLACE FUNCTION assert_journal_entry_period_valid()
RETURNS TRIGGER AS $$
DECLARE
  period_start TIMESTAMP;
  period_end TIMESTAMP;
  period_status "AccountingPeriodStatus";
BEGIN
  SELECT "startsAt", "endsAt", "status"
    INTO period_start, period_end, period_status
  FROM "AccountingPeriod"
  WHERE "businessId" = NEW."businessId"
    AND "id" = NEW."accountingPeriodId";

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Accounting period not found. business=%, period=%',
      NEW."businessId",
      NEW."accountingPeriodId";
  END IF;

  IF NEW."entryDate" < period_start OR NEW."entryDate" > period_end THEN
    RAISE EXCEPTION
      'Journal entry date must fall within accounting period. entry=%, date=%, period_start=%, period_end=%',
      NEW."id",
      NEW."entryDate",
      period_start,
      period_end;
  END IF;

  IF NEW."status" IN ('POSTED', 'REVERSED') AND period_status = 'LOCKED' THEN
    RAISE EXCEPTION
      'Cannot post or reverse a journal entry in a locked accounting period. entry=%, period=%',
      NEW."id",
      NEW."accountingPeriodId";
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER journal_entry_period_is_valid
AFTER INSERT OR UPDATE OF "accountingPeriodId", "entryDate", "status"
ON "JournalEntry"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_journal_entry_period_valid();

-- Prevent attaching a transaction from one financial account to a reconciliation
-- for a different financial account.
CREATE OR REPLACE FUNCTION assert_reconciliation_item_account_matches()
RETURNS TRIGGER AS $$
DECLARE
  reconciliation_account_id TEXT;
  transaction_account_id TEXT;
BEGIN
  SELECT "financialAccountId"
    INTO reconciliation_account_id
  FROM "Reconciliation"
  WHERE "businessId" = NEW."businessId"
    AND "id" = NEW."reconciliationId";

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Reconciliation not found. business=%, reconciliation=%',
      NEW."businessId",
      NEW."reconciliationId";
  END IF;

  SELECT "accountId"
    INTO transaction_account_id
  FROM "Transaction"
  WHERE "businessId" = NEW."businessId"
    AND "id" = NEW."transactionId";

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Transaction not found. business=%, transaction=%',
      NEW."businessId",
      NEW."transactionId";
  END IF;

  IF transaction_account_id <> reconciliation_account_id THEN
    RAISE EXCEPTION
      'Reconciliation item transaction account must match reconciliation account. reconciliation=%, expected_account=%, actual_account=%',
      NEW."reconciliationId",
      reconciliation_account_id,
      transaction_account_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER reconciliation_item_account_matches
AFTER INSERT OR UPDATE OF "reconciliationId", "transactionId"
ON "ReconciliationItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_reconciliation_item_account_matches();
-- ============================================================
-- END: ledger-integrity-constraints.sql
-- ============================================================

-- CAPTURE TRACKER CUSTOM DATABASE INTEGRITY END

-- ============================================================
-- BEGIN: cross-parent-update-hardening.sql
-- ============================================================
-- Capture Tracker cross-parent update hardening.
-- Append after the existing four custom integrity scripts and before applying
-- the initial migration. This replaces selected trigger functions and adds
-- parent-side validation so relational updates cannot leave stale invalid data.

-- ============================================================
-- TRANSACTION SPLIT: VALIDATE BOTH OLD AND NEW PARENTS
-- ============================================================

CREATE OR REPLACE FUNCTION validate_transaction_split_state(
  target_business_id TEXT,
  target_transaction_id TEXT
)
RETURNS VOID AS $$
DECLARE
  parent_amount NUMERIC(18,2);
  parent_intent "TransactionIntent";
  split_total NUMERIC(18,2);
BEGIN
  IF target_business_id IS NULL OR target_transaction_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "amount", "intent"
    INTO parent_amount, parent_intent
  FROM "Transaction"
  WHERE "businessId" = target_business_id
    AND "id" = target_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Parent transaction not found for split validation. business=%, transaction=%',
      target_business_id,
      target_transaction_id;
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO split_total
  FROM "TransactionSplit"
  WHERE "businessId" = target_business_id
    AND "transactionId" = target_transaction_id;

  IF parent_intent = 'MIXED' AND split_total <> parent_amount THEN
    RAISE EXCEPTION
      'Transaction splits must sum to parent amount. transaction=%, expected=%, actual=%',
      target_transaction_id,
      parent_amount,
      split_total;
  END IF;

  IF parent_intent <> 'MIXED' AND split_total <> 0 THEN
    RAISE EXCEPTION
      'Non-mixed transactions cannot retain split rows. transaction=%',
      target_transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_transaction_splits_sum_to_total()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM validate_transaction_split_state(NEW."businessId", NEW."transactionId");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM validate_transaction_split_state(OLD."businessId", OLD."transactionId");
  ELSE
    PERFORM validate_transaction_split_state(OLD."businessId", OLD."transactionId");

    IF NEW."businessId" IS DISTINCT FROM OLD."businessId"
       OR NEW."transactionId" IS DISTINCT FROM OLD."transactionId" THEN
      PERFORM validate_transaction_split_state(NEW."businessId", NEW."transactionId");
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REIMBURSEMENT EXPENSE: VALIDATE BOTH OLD AND NEW CLAIMS
-- ============================================================

CREATE OR REPLACE FUNCTION validate_reimbursement_claim_expense_total(
  target_business_id TEXT,
  target_claim_id TEXT
)
RETURNS VOID AS $$
DECLARE
  claim_total NUMERIC(18,2);
  expense_total NUMERIC(18,2);
BEGIN
  IF target_business_id IS NULL OR target_claim_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "totalAmount"
    INTO claim_total
  FROM "ReimbursementClaim"
  WHERE "businessId" = target_business_id
    AND "id" = target_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Parent reimbursement claim not found for expense validation. business=%, claim=%',
      target_business_id,
      target_claim_id;
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO expense_total
  FROM "ReimbursementExpense"
  WHERE "businessId" = target_business_id
    AND "claimId" = target_claim_id;

  IF expense_total <> claim_total THEN
    RAISE EXCEPTION
      'Reimbursement expenses must sum to claim total. claim=%, expected=%, actual=%',
      target_claim_id,
      claim_total,
      expense_total;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_reimbursement_expenses_sum_to_claim_total()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM validate_reimbursement_claim_expense_total(NEW."businessId", NEW."claimId");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM validate_reimbursement_claim_expense_total(OLD."businessId", OLD."claimId");
  ELSE
    PERFORM validate_reimbursement_claim_expense_total(OLD."businessId", OLD."claimId");

    IF NEW."businessId" IS DISTINCT FROM OLD."businessId"
       OR NEW."claimId" IS DISTINCT FROM OLD."claimId" THEN
      PERFORM validate_reimbursement_claim_expense_total(NEW."businessId", NEW."claimId");
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- JOURNAL LINES: VALIDATE BOTH OLD AND NEW JOURNAL ENTRIES
-- ============================================================

CREATE OR REPLACE FUNCTION validate_journal_entry_balance(
  target_business_id TEXT,
  target_entry_id TEXT
)
RETURNS VOID AS $$
DECLARE
  debit_total NUMERIC(18,2);
  credit_total NUMERIC(18,2);
  entry_status "JournalEntryStatus";
BEGIN
  IF target_business_id IS NULL OR target_entry_id IS NULL THEN
    RETURN;
  END IF;

  SELECT "status"
    INTO entry_status
  FROM "JournalEntry"
  WHERE "businessId" = target_business_id
    AND "id" = target_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Parent journal entry not found. business=%, entry=%',
      target_business_id,
      target_entry_id;
  END IF;

  SELECT
    COALESCE(SUM("debitAmount"), 0),
    COALESCE(SUM("creditAmount"), 0)
  INTO debit_total, credit_total
  FROM "JournalLine"
  WHERE "businessId" = target_business_id
    AND "journalEntryId" = target_entry_id;

  IF entry_status IN ('PENDING_APPROVAL', 'POSTED', 'REVERSED') THEN
    IF debit_total = 0 OR credit_total = 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION
        'Journal entry must balance before approval or posting. entry=%, debits=%, credits=%',
        target_entry_id,
        debit_total,
        credit_total;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assert_journal_entry_balanced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM validate_journal_entry_balance(NEW."businessId", NEW."journalEntryId");
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM validate_journal_entry_balance(OLD."businessId", OLD."journalEntryId");
  ELSE
    PERFORM validate_journal_entry_balance(OLD."businessId", OLD."journalEntryId");

    IF NEW."businessId" IS DISTINCT FROM OLD."businessId"
       OR NEW."journalEntryId" IS DISTINCT FROM OLD."journalEntryId" THEN
      PERFORM validate_journal_entry_balance(NEW."businessId", NEW."journalEntryId");
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ACCOUNTING PERIOD: DATE CHANGES MUST STILL COVER ITS ENTRIES
-- ============================================================

CREATE OR REPLACE FUNCTION assert_accounting_period_dates_cover_entries()
RETURNS TRIGGER AS $$
DECLARE
  invalid_entry_id TEXT;
  invalid_entry_date TIMESTAMP;
BEGIN
  SELECT "id", "entryDate"
    INTO invalid_entry_id, invalid_entry_date
  FROM "JournalEntry"
  WHERE "businessId" = NEW."businessId"
    AND "accountingPeriodId" = NEW."id"
    AND (
      "entryDate" < NEW."startsAt"
      OR "entryDate" > NEW."endsAt"
    )
  ORDER BY "entryDate"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Accounting period date change would exclude an assigned journal entry. period=%, entry=%, entry_date=%',
      NEW."id",
      invalid_entry_id,
      invalid_entry_date;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER accounting_period_dates_cover_entries
AFTER UPDATE OF "startsAt", "endsAt" ON "AccountingPeriod"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_accounting_period_dates_cover_entries();

-- ============================================================
-- RECONCILIATION: PARENT ACCOUNT CHANGES MUST MATCH ALL ITEMS
-- ============================================================

CREATE OR REPLACE FUNCTION assert_reconciliation_account_matches_existing_items()
RETURNS TRIGGER AS $$
DECLARE
  invalid_item_id TEXT;
  invalid_transaction_id TEXT;
  actual_account_id TEXT;
BEGIN
  SELECT item."id", item."transactionId", txn."accountId"
    INTO invalid_item_id, invalid_transaction_id, actual_account_id
  FROM "ReconciliationItem" AS item
  JOIN "Transaction" AS txn
    ON txn."businessId" = item."businessId"
   AND txn."id" = item."transactionId"
  WHERE item."businessId" = NEW."businessId"
    AND item."reconciliationId" = NEW."id"
    AND txn."accountId" <> NEW."financialAccountId"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Reconciliation account change would invalidate an existing item. reconciliation=%, item=%, transaction=%, expected_account=%, actual_account=%',
      NEW."id",
      invalid_item_id,
      invalid_transaction_id,
      NEW."financialAccountId",
      actual_account_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER reconciliation_account_matches_existing_items
AFTER UPDATE OF "financialAccountId" ON "Reconciliation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_reconciliation_account_matches_existing_items();

-- ============================================================
-- TRANSACTION: ACCOUNT CHANGES MUST MATCH RECONCILIATION ITEMS
-- ============================================================

CREATE OR REPLACE FUNCTION assert_transaction_account_matches_reconciliations()
RETURNS TRIGGER AS $$
DECLARE
  invalid_item_id TEXT;
  reconciliation_id TEXT;
  expected_account_id TEXT;
BEGIN
  SELECT item."id", item."reconciliationId", reconciliation."financialAccountId"
    INTO invalid_item_id, reconciliation_id, expected_account_id
  FROM "ReconciliationItem" AS item
  JOIN "Reconciliation" AS reconciliation
    ON reconciliation."businessId" = item."businessId"
   AND reconciliation."id" = item."reconciliationId"
  WHERE item."businessId" = NEW."businessId"
    AND item."transactionId" = NEW."id"
    AND reconciliation."financialAccountId" <> NEW."accountId"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Transaction account change would invalidate a reconciliation item. transaction=%, item=%, reconciliation=%, expected_account=%, actual_account=%',
      NEW."id",
      invalid_item_id,
      reconciliation_id,
      expected_account_id,
      NEW."accountId";
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER transaction_account_matches_reconciliations
AFTER UPDATE OF "accountId" ON "Transaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION assert_transaction_account_matches_reconciliations();

-- CAPTURE TRACKER CROSS-PARENT UPDATE HARDENING END

-- ============================================================
-- END: cross-parent-update-hardening.sql
-- ============================================================
