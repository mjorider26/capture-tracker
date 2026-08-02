export type ActivityEvent = {
  key: string;
  module: string;
  label: string;
  detail: string;
  at: Date;
  href?: string;
};

type AuditInput = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  occurredAt: Date;
  metadataJson?: unknown;
  afterJson?: unknown;
};

const auditPresentation: Record<string, { module: string; label: string; href: (id: string) => string }> = {
  Transaction: { module: "Transactions", label: "Transaction updated", href: (id) => `/money/${id}` },
  Document: { module: "Documents", label: "Document uploaded", href: (id) => `/documents/${id}` },
  Reconciliation: { module: "Reconciliation", label: "Reconciliation updated", href: (id) => `/money/reconciliations/${id}` },
  StatementActivity: { module: "Reconciliation", label: "Statement activity updated", href: () => "/money/reconciliations" },
  TaxPaymentRecord: { module: "Taxes", label: "Tax payment recorded", href: () => "/taxes/estimates" },
  JournalEntry: { module: "Transactions", label: "Journal entry created", href: (id) => `/money/journal/${id}` },
  PracticeWorkspace: { module: "Settings", label: "Business workspace created", href: () => "/settings" },
};

function transactionLabel(action: string): string {
  return ({ CREATE: "Transaction created", UPDATE: "Transaction reviewed", SUPERSEDE: "Transaction corrected", VOID: "Transaction reversed" }[action] ?? "Transaction updated");
}

function flag(value: unknown, name: string): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>)[name] === true);
}
function has(value: unknown, name: string): boolean { return Boolean(value && typeof value === "object" && name in value); }

function reconciliationLabel(metadata: unknown): string {
  const value = metadata && typeof metadata === "object" && "statementActivityAction" in metadata
    ? String((metadata as { statementActivityAction?: unknown }).statementActivityAction)
    : "";
  return ({ MATCH: "Statement activity matched", REJECT: "Statement match rejected", UNMATCH: "Statement activity unmatched", FINALIZE: "Reconciliation finalized" }[value] ?? "Statement activity updated");
}

export function presentAuditEvent(event: AuditInput): ActivityEvent {
  const presentation = auditPresentation[event.entityType] ?? { module: "Accounting", label: "Accounting activity recorded", href: () => "/money" };
  let label = presentation.label;
  if (event.entityType === "Transaction") {
    label = flag(event.metadataJson, "correction") ? "Replacement transaction created" : transactionLabel(event.action);
    if (event.action === "UPDATE" && has(event.afterJson, "splits")) label = "Transaction split updated";
  }
  if (event.entityType === "Reconciliation" && event.action === "CREATE") label = "Reconciliation started";
  if (event.entityType === "Reconciliation" && event.action === "UPDATE") label = "Reconciliation updated";
  if (event.entityType === "StatementActivity") label = reconciliationLabel(event.metadataJson);
  if (event.entityType === "JournalEntry" && flag(event.metadataJson, "reversal")) label = "Transaction reversal created";
  if (event.entityType === "JournalEntry" && flag(event.metadataJson, "correctionReversal")) label = "Transaction correction recorded";
  if (event.entityType === "Document" && event.action !== "CREATE") label = "Document updated";
  return { key: `audit-${event.id}`, module: presentation.module, label, detail: "Recorded activity", at: event.occurredAt, href: presentation.href(event.entityId) };
}

export function sanitizeActivityEvents(events: ActivityEvent[], raw: { module?: string; q?: string; from?: string; to?: string; order?: string; page?: string; size?: string } = {}) {
  const activeModule = raw.module ?? "";
  const q = (raw.q ?? "").replace(/[<>]/g, "").trim().slice(0, 80).toLowerCase();
  const from = /^\d{4}-\d\d-\d\d$/.test(raw.from ?? "") ? new Date(`${raw.from}T00:00:00.000Z`) : undefined;
  const to = /^\d{4}-\d\d-\d\d$/.test(raw.to ?? "") ? new Date(`${raw.to}T23:59:59.999Z`) : undefined;
  const descending = raw.order !== "oldest";
  const page = Math.max(1, Math.min(500, Number(raw.page) || 1));
  const size = Math.max(5, Math.min(50, Number(raw.size) || 20));
  const filtered = events.filter((event) => (!activeModule || event.module === activeModule) && (!from || event.at >= from) && (!to || event.at <= to) && (!q || `${event.label} ${event.detail} ${event.module}`.toLowerCase().includes(q))).sort((a, b) => descending ? b.at.getTime() - a.at.getTime() || b.key.localeCompare(a.key) : a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
  return { events: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, size, filters: { module: activeModule, q, from: raw.from ?? "", to: raw.to ?? "", order: descending ? "newest" : "oldest" } };
}

export type SettingsInput = { defaultReportPeriod: string; weeklyReviewDay: number; retentionMonths: number; expectedUpdatedAt: string };
const periods = new Set(["month", "last-month", "quarter", "ytd", "previous-year"]);

export function parseSettingsInput(form: FormData): SettingsInput | null {
  const defaultReportPeriod = String(form.get("defaultReportPeriod") ?? "");
  const weeklyReviewDay = Number(form.get("weeklyReviewDay"));
  const retentionMonths = Number(form.get("retentionMonths"));
  const expectedUpdatedAt = String(form.get("expectedUpdatedAt") ?? "");
  if (!periods.has(defaultReportPeriod) || !Number.isInteger(weeklyReviewDay) || weeklyReviewDay < 0 || weeklyReviewDay > 6 || !Number.isInteger(retentionMonths) || retentionMonths < 12 || retentionMonths > 120 || (expectedUpdatedAt && Number.isNaN(Date.parse(expectedUpdatedAt)))) return null;
  return { defaultReportPeriod, weeklyReviewDay, retentionMonths, expectedUpdatedAt };
}
