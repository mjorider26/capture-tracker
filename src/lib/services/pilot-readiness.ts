import "server-only";

import { getFinancialReports } from "@/lib/data/reports";
import { prisma } from "@/lib/prisma";

import { parseSettingsInput, presentAuditEvent, sanitizeActivityEvents, type SettingsInput } from "./pilot-readiness-core";

export type PilotActor = { businessId: string; actorUserId: string };
const safe = (value: string) => { const escaped = value.replaceAll('"', '""'); return /^\s*[=+\-@]/.test(escaped) ? `'${escaped}` : escaped; };
const exportRowLimit = 50_000;
async function ensureExportSize(count: Promise<number>) { if (await count > exportRowLimit) throw new Error("EXPORT_TOO_LARGE"); }
const text = (v: FormDataEntryValue | null, max: number) => typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "";

export async function getPilotState(businessId: string) {
  const [business, onboarding, settings, exports] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { displayName: true, legalName: true, timezone: true, fiscalYearStartMonth: true, currency: true } }),
    prisma.businessOnboarding.findUnique({ where: { businessId } }),
    prisma.businessSettings.findUnique({ where: { businessId } }),
    prisma.exportAudit.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { business, onboarding, settings, exports };
}

export async function saveOnboarding(actor: PilotActor, form: FormData) {
  const ownerDisplayName = text(form.get("ownerDisplayName"), 120);
  const displayName = text(form.get("displayName"), 120);
  const description = text(form.get("description"), 500) || null;
  const timezone = text(form.get("timezone"), 64);
  const fiscal = Number(form.get("fiscalYearStartMonth"));
  if (!ownerDisplayName || !displayName || !/^America\/[A-Za-z_]+$/.test(timezone) || !Number.isInteger(fiscal) || fiscal < 1 || fiscal > 12) return false;
  const complete = form.get("fictionalAcknowledged") === "on" && form.get("chartConfirmed") === "on";
  await prisma.$transaction(async (tx) => {
    await tx.business.update({ where: { id: actor.businessId }, data: { displayName, timezone, fiscalYearStartMonth: fiscal } });
    await tx.businessOnboarding.upsert({ where: { businessId: actor.businessId }, create: { businessId: actor.businessId, actorUserId: actor.actorUserId, ownerDisplayName, description, fictionalAcknowledged: complete, chartConfirmed: complete, status: complete ? "COMPLETED" : "IN_PROGRESS", completedAt: complete ? new Date() : null }, update: { actorUserId: actor.actorUserId, ownerDisplayName, description, fictionalAcknowledged: complete, chartConfirmed: complete, status: complete ? "COMPLETED" : "IN_PROGRESS", completedAt: complete ? new Date() : null } });
  });
  return true;
}

export type SaveSettingsResult = "SAVED" | "UNCHANGED" | "INVALID" | "STALE";
export async function saveSettings(actor: PilotActor, form: FormData): Promise<SaveSettingsResult> {
  const input = parseSettingsInput(form);
  if (!input) return "INVALID";
  return prisma.$transaction(async (tx) => {
    const current = await tx.businessSettings.findUnique({ where: { businessId: actor.businessId }, select: { updatedAt: true, defaultReportPeriod: true, weeklyReviewDay: true, retentionMonths: true } });
    if (current) {
      if (!input.expectedUpdatedAt || current.updatedAt.toISOString() !== input.expectedUpdatedAt) return "STALE";
      if (sameSettings(current, input)) return "UNCHANGED";
      const update = await tx.businessSettings.updateMany({ where: { businessId: actor.businessId, updatedAt: current.updatedAt }, data: settingData(input) });
      if (update.count !== 1) return "STALE";
    } else {
      if (input.expectedUpdatedAt) return "STALE";
      await tx.businessSettings.create({ data: { businessId: actor.businessId, ...settingData(input) } });
    }
    await tx.businessSettingsHistory.create({ data: { businessId: actor.businessId, actorUserId: actor.actorUserId, changedJson: settingData(input) } });
    return "SAVED";
  });
}
function settingData(input: SettingsInput) { return { defaultReportPeriod: input.defaultReportPeriod, weeklyReviewDay: input.weeklyReviewDay, retentionMonths: input.retentionMonths }; }
function sameSettings(current: { defaultReportPeriod: string; weeklyReviewDay: number; retentionMonths: number }, input: SettingsInput) { return current.defaultReportPeriod === input.defaultReportPeriod && current.weeklyReviewDay === input.weeklyReviewDay && current.retentionMonths === input.retentionMonths; }

export type ActivityQuery = { module?: string; q?: string; from?: string; to?: string; order?: string; page?: string; size?: string };
const activityModules = new Set(["Accounting", "Transactions", "Documents", "Reconciliation", "Taxes", "Weekly Review", "Ask AI", "Settings", "Exports"]);
export async function getActivity(businessId: string, raw: ActivityQuery = {}) {
  const activeModule = activityModules.has(raw.module ?? "") ? raw.module : "";
  const [audits, docs, reviews, ai, settings, exports] = await Promise.all([
    prisma.auditEvent.findMany({ where: { businessId }, orderBy: { occurredAt: "desc" }, take: 100, select: { id: true, entityType: true, entityId: true, action: true, occurredAt: true, metadataJson: true, afterJson: true } }),
    prisma.documentStatusHistory.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, documentId: true, newStatus: true, createdAt: true } }),
    prisma.weeklyReviewHistory.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, createdAt: true } }),
    prisma.askAiEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, createdAt: true } }),
    prisma.businessSettingsHistory.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, createdAt: true } }),
    prisma.exportAudit.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, kind: true, createdAt: true, rowCount: true } }),
  ]);
  return sanitizeActivityEvents([
    ...audits.map(presentAuditEvent),
    ...docs.map((event) => ({ key: `document-${event.id}`, module: "Documents", label: `Document marked ${event.newStatus.toLowerCase().replaceAll("_", " ")}`, detail: "Document activity", at: event.createdAt, href: `/documents/${event.documentId}` })),
    ...reviews.map((event) => ({ key: `review-${event.id}`, module: "Weekly Review", label: event.action === "COMPLETED" ? "Weekly Review completed" : event.action === "STARTED" ? "Weekly Review started" : "Weekly Review updated", detail: "Review activity", at: event.createdAt, href: "/review" })),
    ...ai.map((event) => ({ key: `ai-${event.id}`, module: "Ask AI", label: event.action === "QUESTION_SUBMITTED" ? "Ask AI question submitted" : "Ask AI activity recorded", detail: "Ask AI activity", at: event.createdAt, href: "/ask-ai" })),
    ...settings.map((event) => ({ key: `settings-${event.id}`, module: "Settings", label: "Settings changed", detail: "Business preferences updated", at: event.createdAt, href: "/settings" })),
    ...exports.map((event) => ({ key: `export-${event.id}`, module: "Exports", label: `${event.kind.toLowerCase().replaceAll("_", " ")} export created`, detail: `${event.rowCount} rows exported`, at: event.createdAt })),
  ], { ...raw, module: activeModule });
}

export async function buildExport(actor: PilotActor, kind: string) { const valid = ["TRANSACTIONS", "JOURNAL", "ACCOUNTS", "REPORTS", "DOCUMENTS", "DOCUMENT_LINKS", "WEEKLY_REVIEW", "ASK_AI"] as const; if (!valid.includes(kind as typeof valid[number])) return null; let headers: string[] = []; let rows: string[][] = []; if (kind === "TRANSACTIONS") { const where = { businessId: actor.businessId }; await ensureExportSize(prisma.transaction.count({ where })); const records = await prisma.transaction.findMany({ where, orderBy: { postedAt: "desc" }, select: { postedAt: true, description: true, merchantName: true, amount: true, status: true, intent: true } }); headers=["Posted date","Description","Merchant","Amount","Status","Intent"]; rows=records.map(x=>[x.postedAt.toISOString().slice(0,10),x.description,x.merchantName??"",x.amount.toFixed(2),x.status,x.intent]); } else if (kind === "ACCOUNTS") { const where={businessId:actor.businessId}; await ensureExportSize(prisma.ledgerAccount.count({where})); const records=await prisma.ledgerAccount.findMany({where,orderBy:{code:"asc"},select:{code:true,name:true,type:true,normalBalance:true}}); headers=["Code","Name","Type","Normal balance"]; rows=records.map(x=>[x.code,x.name,x.type,x.normalBalance]); } else if (kind === "DOCUMENTS") { const where={businessId:actor.businessId}; await ensureExportSize(prisma.document.count({where})); const records=await prisma.document.findMany({where,select:{displayName:true,type:true,category:true,status:true,uploadedAt:true}}); headers=["Name","Type","Category","Status","Uploaded"]; rows=records.map(x=>[x.displayName,x.type,x.category,x.status,x.uploadedAt.toISOString()]); } else if (kind === "WEEKLY_REVIEW") { const where={businessId:actor.businessId}; await ensureExportSize(prisma.weeklyReviewHistory.count({where})); const records=await prisma.weeklyReviewHistory.findMany({where,orderBy:{createdAt:"desc"},select:{action:true,section:true,unresolvedItemCount:true,createdAt:true}}); headers=["Action","Section","Unresolved items","Recorded"]; rows=records.map(x=>[x.action,x.section??"",String(x.unresolvedItemCount??""),x.createdAt.toISOString()]); } else { const report=await getFinancialReports(actor.businessId); headers=["Report","Period","Value"]; rows=[["Profit and Loss income",report.range.label,report.profitAndLoss.totalIncome],["Profit and Loss expenses",report.range.label,report.profitAndLoss.totalExpenses],["Profit and Loss net income",report.range.label,report.profitAndLoss.netIncome],["Cash ending",report.range.label,report.cashActivity.endingCash]]; }
  const csv = [headers, ...rows].map(row => row.map(value => `"${safe(value)}"`).join(",")).join("\n"); const manifest={ kind, rows: rows.length, excluded:["document bytes","storage keys","private grants","secrets","hidden reasoning"] }; await prisma.exportAudit.create({data:{businessId:actor.businessId,actorUserId:actor.actorUserId,kind:kind as typeof valid[number],rowCount:rows.length,manifest}}); return { csv, filename:`capture-tracker-${kind.toLowerCase()}.csv`, manifest };
}
