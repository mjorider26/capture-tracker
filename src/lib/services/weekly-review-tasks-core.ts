export type WeeklyReviewTaskCategory =
  | "Transactions"
  | "Documents"
  | "Reconciliation"
  | "Taxes";

export type WeeklyReviewTask = {
  id: string;
  category: WeeklyReviewTaskCategory;
  title: string;
  explanation: string;
  detail: string;
  href: string;
  state: "UNRESOLVED";
};

type Transaction = {
  id: string;
  description: string;
  postedAt: Date;
  amount: { toFixed: (digits: number) => string };
  status: string;
  intent: string;
  splits: Array<{ amount: { toFixed: (digits: number) => string } }>;
};

type Document = {
  id: string;
  displayName: string;
  uploadedAt: Date;
  status: string;
  malwareScanStatus: string;
  extractionAttempts: Array<{
    status: string;
    candidates: Array<{ id: string; fieldType: string; reviewState: string }>;
  }>;
};

type MatchSuggestion = {
  id: string;
  status: string;
  score: number;
  transactionAmount: { toFixed: (digits: number) => string };
  transactionPostedAt: Date;
  run: { status: string; document: { id: string; displayName: string; malwareScanStatus: string } };
};

type ReconciliationItem = {
  id: string;
  status: string;
  reconciliation: {
    id: string;
    status: string;
    statementEndDate: Date;
    financialAccount: { name: string };
  };
  transaction: { id: string; description: string; amount: { toFixed: (digits: number) => string }; postedAt: Date };
};

type StatementActivity = { id: string; description: string; activityDate: Date; amount: { toFixed: (digits: number) => string }; reconciliation: { id: string; status: string; financialAccount: { name: string } } };

type TaxEstimate = {
  id: string;
  status: string;
  taxYear: number;
  quarter: number;
  jurisdictionCode: string;
  dueDate: Date;
  recommendedPayment: { toFixed: (digits: number) => string };
  payments: Array<{ amount: { toFixed: (digits: number) => string }; status: string }>;
};

type ExternalTransaction = {
  id: string;
  description: string;
  transactionDate: Date;
  amount: { toFixed: (digits: number) => string };
  status: string;
  financialAccount: { name: string };
};

export type WeeklyReviewTaskRecords = {
  transactions: Transaction[];
  documents: Document[];
  matchSuggestions: MatchSuggestion[];
  reconciliationItems: ReconciliationItem[];
  statementActivities: StatementActivity[];
  taxEstimates: TaxEstimate[];
  externalTransactions?: ExternalTransaction[];
};

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(value);

const money = (value: { toFixed: (digits: number) => string }) =>
  `$${value.toFixed(2)}`;

const add = (tasks: WeeklyReviewTask[], task: WeeklyReviewTask) => {
  if (!tasks.some((existing) => existing.id === task.id)) tasks.push(task);
};

const invalidMixedSplit = (transaction: Transaction) => {
  if (transaction.intent !== "MIXED") return false;
  if (transaction.splits.length < 2) return true;
  const total = transaction.splits.reduce(
    (sum, split) => sum + Number(split.amount.toFixed(2)),
    0,
  );
  return Math.abs(total - Number(transaction.amount.toFixed(2))) > 0.00001;
};

/**
 * Creates only actions that are currently supported by a protected workflow.
 * IDs are deterministic task-type/source pairs, so a refresh cannot duplicate
 * a record even when it meets more than one independent condition.
 */
export function buildWeeklyReviewTasks(
  records: WeeklyReviewTaskRecords,
): WeeklyReviewTask[] {
  const tasks: WeeklyReviewTask[] = [];

  for (const transaction of records.transactions) {
    const detail = `${formatDate(transaction.postedAt)} · ${money(transaction.amount)} · ${transaction.status.replaceAll("_", " ").toLowerCase()}`;
    if (transaction.status === "PENDING_REVIEW") {
      add(tasks, {
        id: `transaction-awaiting-review:${transaction.id}`,
        category: "Transactions",
        title: `Review ${transaction.description}`,
        explanation: "Classify this transaction before it reaches the books.",
        detail,
        href: `/money/${transaction.id}`,
        state: "UNRESOLVED",
      });
    }
    if (
      transaction.status === "PENDING_REVIEW" &&
      transaction.intent === "UNREVIEWED"
    ) {
      add(tasks, {
        id: `transaction-missing-classification:${transaction.id}`,
        category: "Transactions",
        title: `Choose a classification for ${transaction.description}`,
        explanation: "The transaction still needs a business, personal, or mixed decision.",
        detail,
        href: `/money/${transaction.id}`,
        state: "UNRESOLVED",
      });
    }
    if (transaction.status === "PENDING_REVIEW" && invalidMixedSplit(transaction)) {
      add(tasks, {
        id: `transaction-invalid-mixed-split:${transaction.id}`,
        category: "Transactions",
        title: `Fix the mixed split for ${transaction.description}`,
        explanation: "Mixed allocations need at least two parts that equal the transaction amount.",
        detail,
        href: `/money/${transaction.id}`,
        state: "UNRESOLVED",
      });
    }
  }

  for (const transaction of records.externalTransactions ?? []) {
    add(tasks, {
      id: `imported-activity:${transaction.id}`,
      category: "Transactions",
      title: `${transaction.status === "POSSIBLE_DUPLICATE" ? "Resolve possible duplicate" : "Classify imported activity"}: ${transaction.description}`,
      explanation: transaction.status === "POSSIBLE_DUPLICATE" ? "This activity resembles prior imported activity and cannot reach the books until you decide it." : "Choose the accounting category before this imported activity reaches the books.",
      detail: `${formatDate(transaction.transactionDate)} Â· ${money(transaction.amount)} Â· ${transaction.financialAccount.name}`,
      href: "/money/import",
      state: "UNRESOLVED",
    });
  }

  for (const document of records.documents) {
    const detail = `${formatDate(document.uploadedAt)} · ${document.status.replaceAll("_", " ").toLowerCase()}`;
    if (document.status === "PENDING_VALIDATION") {
      add(tasks, {
        id: `document-review:${document.id}`,
        category: "Documents",
        title: `Review ${document.displayName}`,
        explanation: "This document needs a validation decision before it can be used as evidence.",
        detail,
        href: `/documents/${document.id}`,
        state: "UNRESOLVED",
      });
    }
    if (document.status === "QUARANTINED" && document.malwareScanStatus === "FAILED") {
      add(tasks, { id: `document-scan-failed:${document.id}`, category: "Documents", title: `Security scan could not complete for ${document.displayName}`, explanation: "The document remains private and unavailable until security scanning succeeds.", detail, href: `/documents/${document.id}`, state: "UNRESOLVED" });
    }
    if (document.status === "REJECTED" || document.malwareScanStatus === "INFECTED") {
      add(tasks, { id: `document-security-rejected:${document.id}`, category: "Documents", title: `Replace rejected document ${document.displayName}`, explanation: "This document failed its security scan and cannot be used as evidence.", detail, href: `/documents/${document.id}`, state: "UNRESOLVED" });
    }
    if (document.status !== "ACTIVE" || document.malwareScanStatus !== "CLEAN") continue;
    for (const attempt of document.extractionAttempts) {
      if (attempt.status !== "COMPLETED") continue;
      for (const candidate of attempt.candidates) {
        if (candidate.reviewState !== "UNREVIEWED") continue;
        add(tasks, {
          id: `extraction-candidate:${candidate.id}`,
          category: "Documents",
          title: `Review extracted ${candidate.fieldType.replaceAll("_", " ").toLowerCase()} for ${document.displayName}`,
          explanation: "Accept, correct, or reject this extraction evidence before using it.",
          detail,
          href: `/documents/${document.id}`,
          state: "UNRESOLVED",
        });
      }
    }
  }

  for (const suggestion of records.matchSuggestions) {
    if (suggestion.status !== "SUGGESTED" || suggestion.run.status !== "COMPLETED" || suggestion.run.document.malwareScanStatus !== "CLEAN") continue;
    add(tasks, {
      id: `document-match:${suggestion.id}`,
      category: "Documents",
      title: `Decide the match for ${suggestion.run.document.displayName}`,
      explanation: "Approve and link this suggestion, or reject it. Matching never changes the books automatically.",
      detail: `${formatDate(suggestion.transactionPostedAt)} · ${money(suggestion.transactionAmount)} · match strength ${suggestion.score}/100`,
      href: `/documents/${suggestion.run.document.id}`,
      state: "UNRESOLVED",
    });
  }

  for (const item of records.reconciliationItems) {
    if (item.status !== "OUTSTANDING" || !["DRAFT", "IN_PROGRESS"].includes(item.reconciliation.status)) continue;
    add(tasks, {
      id: `unreconciled-transaction:${item.reconciliation.id}:${item.transaction.id}`,
      category: "Reconciliation",
      title: `Reconcile ${item.transaction.description}`,
      explanation: `This transaction is still outstanding in ${item.reconciliation.financialAccount.name}.`,
      detail: `${formatDate(item.transaction.postedAt)} · ${money(item.transaction.amount)} · statement ending ${formatDate(item.reconciliation.statementEndDate)}`,
      href: `/money/reconciliations/${item.reconciliation.id}`,
      state: "UNRESOLVED",
    });
  }

  for (const activity of records.statementActivities) {
    if (!["DRAFT", "IN_PROGRESS"].includes(activity.reconciliation.status)) continue;
    add(tasks, { id: `unmatched-statement-activity:${activity.id}`, category: "Reconciliation", title: `Match statement activity: ${activity.description}`, explanation: `This imported activity is still unmatched in ${activity.reconciliation.financialAccount.name}.`, detail: `${formatDate(activity.activityDate)} · ${money(activity.amount)} · unmatched`, href: `/money/reconciliations/${activity.reconciliation.id}`, state: "UNRESOLVED" });
  }

  for (const estimate of records.taxEstimates) {
    if (!["DRAFT", "READY_FOR_REVIEW"].includes(estimate.status)) continue;
    const recorded = estimate.payments
      .filter((payment) => payment.status === "RECORDED")
      .reduce((total, payment) => total + Number(payment.amount.toFixed(2)), 0);
    const remaining = Number(estimate.recommendedPayment.toFixed(2)) - recorded;
    if (remaining <= 0) continue;
    add(tasks, {
      id: `quarterly-tax-estimate:${estimate.id}`,
      category: "Taxes",
      title: `Record ${estimate.taxYear} Q${estimate.quarter} tax payment`,
      explanation: `The ${estimate.jurisdictionCode} estimate still has a payment to record.`,
      detail: `Due ${formatDate(estimate.dueDate)} · remaining $${remaining.toFixed(2)}`,
      href: `/taxes/estimates/${estimate.id}`,
      state: "UNRESOLVED",
    });
  }

  const order = { Transactions: 0, Documents: 1, Reconciliation: 2, Taxes: 3 };
  return tasks.sort(
    (left, right) => order[left.category] - order[right.category] || left.id.localeCompare(right.id),
  );
}

export function countWeeklyReviewTasks(tasks: WeeklyReviewTask[]) {
  return tasks.filter((task) => task.state === "UNRESOLVED").length;
}
