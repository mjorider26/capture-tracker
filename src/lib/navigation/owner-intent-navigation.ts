export type WorkspaceRole = "OWNER" | "CPA_READ_ONLY";

export type WorkspaceEntry = {
  id: string;
  label: string;
  description: string;
  path: string;
  keywords: readonly string[];
  ownerOnly?: boolean;
  quickAdd?: boolean;
};

export const workspaceEntries: readonly WorkspaceEntry[] = [
  { id: "create-invoice", label: "Create invoice", description: "Bill a customer for services and track what they owe.", path: "/money/invoices?new=invoice", keywords: ["invoice", "customer", "get paid", "receivable", "ar"], ownerOnly: true, quickAdd: true },
  { id: "open-invoices", label: "Open invoices", description: "Review customer invoices and payment status.", path: "/money/invoices", keywords: ["invoice", "customer", "get paid", "receivable", "ar"] },
  { id: "ar-aging", label: "Who owes me money? (AR Aging)", description: "See unpaid customer balances grouped by age.", path: "/reports/operations?report=ar-aging", keywords: ["invoice", "customer", "receivable", "ar", "owed", "aging"] },
  { id: "add-bill", label: "Add bill", description: "Record a vendor obligation before its payment is matched.", path: "/money/bills?new=bill", keywords: ["bill", "vendor", "payable", "ap", "owe"], ownerOnly: true, quickAdd: true },
  { id: "open-bills", label: "Open bills", description: "Review vendor bills, due dates, and payment status.", path: "/money/bills", keywords: ["bill", "vendor", "payable", "ap", "owe"] },
  { id: "ap-aging", label: "What do I owe? (AP Aging)", description: "See unpaid vendor balances grouped by age.", path: "/reports/operations?report=ap-aging", keywords: ["bill", "vendor", "payable", "ap", "owe", "aging"] },
  { id: "upload-receipt", label: "Add receipt", description: "Add private supporting evidence for security validation.", path: "/documents#document-upload", keywords: ["receipt", "document", "upload", "evidence"], ownerOnly: true, quickAdd: true },
  { id: "documents", label: "Documents", description: "Review receipt validation, matching, and linked evidence.", path: "/documents", keywords: ["receipt", "document", "upload", "evidence", "scan"] },
  { id: "record-mileage", label: "Record mileage", description: "Log a substantiated business trip for reimbursement.", path: "/taxes/mileage#record-trip", keywords: ["mileage", "miles", "trip", "drive", "reimbursement"], ownerOnly: true, quickAdd: true },
  { id: "mileage-log", label: "Mileage log", description: "Review business trips and reimbursement status.", path: "/reports/operations?report=mileage-log", keywords: ["mileage", "miles", "trip", "drive", "reimbursement"] },
  { id: "owner-paid-expense", label: "Record owner-paid expense", description: "Create a reimbursement claim for a business cost you paid personally.", path: "/taxes/owner-money?new=expense#personally-paid-expense", keywords: ["owner", "paid", "expense", "reimbursement", "receipt"], ownerOnly: true, quickAdd: true },
  { id: "owner-transfer", label: "Record owner transfer", description: "Review money moving between you and the S-Corp without guessing its treatment.", path: "/taxes/owner-money#owner-transfer", keywords: ["owner", "transfer", "distribution", "contribution", "loan"], ownerOnly: true, quickAdd: true },
  { id: "owner-money", label: "Owner Money", description: "Keep salary, distributions, reimbursements, contributions, loans, basis, benefits, and mileage distinct.", path: "/taxes/owner-money", keywords: ["owner", "s corp", "salary", "distribution", "contribution", "loan", "basis", "benefit"], ownerOnly: true },
  { id: "s-corp-workpapers", label: "S-Corp workpapers", description: "Review stock basis, debt basis, benefits, and distribution-readiness evidence.", path: "/taxes/owner-money/s-corp", keywords: ["owner", "s corp", "basis", "debt", "stock", "benefit", "distribution"], ownerOnly: true },
  { id: "import-transactions", label: "Import transactions", description: "Bring in a bank or card CSV for controlled review.", path: "/money/import", keywords: ["import", "csv", "bank", "transaction", "activity"], ownerOnly: true, quickAdd: true },
  { id: "review-activity", label: "Review activity", description: "Classify transaction exceptions and supporting evidence.", path: "/money", keywords: ["review", "activity", "transaction", "books", "current"] },
  { id: "reconciliation", label: "Reconciliation", description: "Match statement evidence and reach an exact $0.00 difference.", path: "/money/reconciliations", keywords: ["reconcile", "reconciliation", "statement", "books current"] },
  { id: "books-current", label: "Books Current Through", description: "See the deterministic evidence that controls the current-through date.", path: "/taxes/close", keywords: ["books", "current", "close", "month", "reconcile"] },
  { id: "profit-loss", label: "Profit & Loss", description: "See business income, expenses, and net income for a period.", path: "/reports/profit-and-loss", keywords: ["profit", "loss", "p&l", "p and l", "income", "expense", "business doing"] },
  { id: "balance-sheet", label: "Balance Sheet", description: "See what the business owns, owes, and retains.", path: "/reports/balance-sheet", keywords: ["balance", "sheet", "asset", "liability", "equity", "business doing"] },
  { id: "cpa-access", label: "Manage CPA access", description: "Invite or revoke a secure read-only professional reviewer.", path: "/settings/cpa", keywords: ["cpa", "accountant", "invite", "access"], ownerOnly: true },
  { id: "cpa-package", label: "CPA package", description: "Download tenant-scoped accounting schedules and the PDF index.", path: "/reports", keywords: ["cpa", "accountant", "package", "export", "year end"] },
  { id: "year-end", label: "Year-End Flight Check", description: "Resolve deterministic bookkeeping exceptions before CPA handoff.", path: "/taxes/year-end", keywords: ["year end", "year-end", "cpa", "close", "flight check", "tax"] },
];

export function workspaceEntriesForRole(role: WorkspaceRole) {
  return workspaceEntries.filter((entry) => role === "OWNER" || !entry.ownerOnly);
}

export function quickAddEntries(role: WorkspaceRole) {
  return workspaceEntriesForRole(role).filter((entry) => entry.quickAdd);
}

export function quickAddGroups(role: WorkspaceRole) {
  const entries = quickAddEntries(role);
  const groups = [
    { label: "Money in", ids: ["create-invoice"] },
    { label: "Money out", ids: ["add-bill"] },
    { label: "Capture", ids: ["upload-receipt", "record-mileage"] },
    { label: "Owner", ids: ["owner-paid-expense", "owner-transfer"] },
    { label: "Import", ids: ["import-transactions"] },
  ];
  return groups.map((group) => ({ label: group.label, entries: group.ids.flatMap((id) => entries.filter((entry) => entry.id === id)) })).filter((group) => group.entries.length);
}

export function findWorkspaceEntries(query: string, role: WorkspaceRole) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return workspaceEntriesForRole(role).filter((entry) => !entry.ownerOnly).slice(0, 8);
  return workspaceEntriesForRole(role).filter((entry) => {
    const haystack = [entry.label, entry.description, ...entry.keywords].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function workspaceHref(basePath: "/app" | "/demo", entry: WorkspaceEntry) {
  if (basePath === "/demo") {
    if (!isWorkspaceEntryAvailable(basePath, entry)) return "/demo/today";
  }
  return `${basePath}${entry.path}`;
}

export function isWorkspaceEntryAvailable(basePath: "/app" | "/demo", entry: WorkspaceEntry) {
  if (basePath === "/app") return true;
  return new Set([
    "upload-receipt",
    "documents",
    "owner-paid-expense",
    "owner-transfer",
    "owner-money",
    "s-corp-workpapers",
    "import-transactions",
    "review-activity",
    "reconciliation",
    "profit-loss",
    "balance-sheet",
    "year-end",
  ]).has(entry.id);
}
