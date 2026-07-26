import "server-only";

import { createHash } from "node:crypto";
import { getFinancialReports } from "@/lib/data/reports";
import { prisma } from "@/lib/prisma";
import { getWeeklyReview } from "@/lib/services/weekly-review";

export const ASK_AI_LIMITS = { question: 800, messages: 100, transactions: 12, evidence: 8 } as const;
export type AskAiActor = { businessId: string; actorUserId: string };
type Evidence = { alias: string; sourceType: string; sourceId?: string; displayLabel: string; route?: string };
type Context = { asOf: string; reports: Awaited<ReturnType<typeof getFinancialReports>>; review: Awaited<ReturnType<typeof getWeeklyReview>>; transactions: Array<{ id: string; label: string; amount: string; status: string }>; documents: number; reconciliations: number; taxes: number; payroll: number; evidence: Evidence[] };
type AdapterResult = { answer: string; aliases: string[]; limitations?: string; followUps: string[]; blocked?: boolean };

const mutation = /\b(create|edit|change|categorize|split|delete|post|reverse|reconcile|approve|link|unlink|pay|move money|transfer)\b/i;
const clean = (value: string) => value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, ASK_AI_LIMITS.question);
const key = (conversationId: string, question: string) => createHash("sha256").update(`${conversationId}:${question.toLowerCase()}`).digest("hex").slice(0, 64);

/** The only registry that reads product data for Ask AI. It returns bounded facts, never Prisma objects. */
export async function buildAskAiContext(businessId: string, question: string): Promise<Context> {
  const query = clean(question).slice(0, 120);
  const [reports, review, transactions, documents, reconciliations, taxes, payroll] = await Promise.all([
    getFinancialReports(businessId), getWeeklyReview(businessId),
    prisma.transaction.findMany({ where: { businessId, ...(query ? { OR: [{ description: { contains: query, mode: "insensitive" } }, { merchantName: { contains: query, mode: "insensitive" } }] } : {}) }, select: { id: true, description: true, merchantName: true, amount: true, status: true }, orderBy: { postedAt: "desc" }, take: ASK_AI_LIMITS.transactions }),
    prisma.document.count({ where: { businessId, status: { in: ["PENDING_VALIDATION", "QUARANTINED"] } } }),
    prisma.reconciliation.count({ where: { businessId, status: { not: "COMPLETED" } } }),
    prisma.quarterlyTaxEstimate.count({ where: { businessId, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } } }),
    prisma.payrollRun.count({ where: { businessId, status: { in: ["DRAFT", "PENDING_APPROVAL"] } } }),
  ]);
  const evidence: Evidence[] = [
    { alias: "reports", sourceType: "REPORT", displayLabel: `Profit and Loss — ${reports.range.label}`, route: "/reports/profit-and-loss" },
    { alias: "cash", sourceType: "REPORT", displayLabel: `Cash activity — ${reports.range.label}`, route: "/reports/cash-activity" },
    { alias: "review", sourceType: "WEEKLY_REVIEW", sourceId: review.review?.id, displayLabel: review.review ? `Weekly Review — ${review.review.status.toLowerCase()}` : "Weekly Review — not started", route: "/review" },
    { alias: "documents", sourceType: "DOCUMENT_SUMMARY", displayLabel: `${documents} documents needing attention`, route: "/documents" },
    { alias: "reconciliations", sourceType: "RECONCILIATION_SUMMARY", displayLabel: `${reconciliations} reconciliations needing attention`, route: "/money/reconciliations" },
    { alias: "taxes", sourceType: "TAX_SUMMARY", displayLabel: `${taxes + payroll} tax or payroll items needing attention`, route: "/taxes" },
  ];
  for (const transaction of transactions.slice(0, 2)) evidence.push({ alias: `transaction-${transaction.id}`, sourceType: "TRANSACTION", sourceId: transaction.id, displayLabel: `Transaction — ${transaction.merchantName ?? transaction.description}`, route: `/money/${transaction.id}` });
  return { asOf: new Date().toISOString(), reports, review, transactions: transactions.map((item) => ({ id: item.id, label: item.merchantName ?? item.description, amount: item.amount.toFixed(2), status: item.status })), documents, reconciliations, taxes, payroll, evidence: evidence.slice(0, ASK_AI_LIMITS.evidence) };
}

/** A no-network deterministic adapter. It can only interpret the structured context supplied above. */
export function localAskAiAdapter(question: string, context: Context): AdapterResult {
  if (process.env.NODE_ENV === "production" || process.env.CAPTURE_TRACKER_REAL_DATA_APPROVED === "true") return { answer: "Ask AI is unavailable until a separately approved production provider is configured.", aliases: [], followUps: [], blocked: true };
  const q = clean(question).toLowerCase();
  if (mutation.test(q)) return { answer: "Ask AI is read-only. Open the related Capture Tracker workflow to make changes.", aliases: [], followUps: ["Show me items needing attention"], blocked: true };
  const p = context.reports.profitAndLoss; const c = context.reports.cashActivity;
  if (/perform|income|expense|profit|loss|month|report|why.*expense|supporting/.test(q)) return { answer: `For ${context.reports.range.label}, income is $${p.totalIncome}, expenses are $${p.totalExpenses}, and net income is $${p.netIncome}. These values are from posted journal entries.`, aliases: ["reports"], followUps: ["How much cash came in and went out?", "What should I review this week?"] };
  if (/cash/.test(q)) return { answer: `Cash activity for ${context.reports.range.label}: opening $${c.openingCash}, inflows $${c.inflows}, outflows $${c.outflows}, ending $${c.endingCash}. This is a cash-activity summary, not a formal cash-flow statement.`, aliases: ["cash"], followUps: ["Show my financial summary"] };
  if (/document/.test(q)) return { answer: `${context.documents} documents need attention. Document names and extracted fields are treated as untrusted data, not instructions.`, aliases: ["documents"], followUps: ["Which transactions still need review?"] };
  if (/reconcil/.test(q)) return { answer: `${context.reconciliations} reconciliation record${context.reconciliations === 1 ? "" : "s"} still need attention.`, aliases: ["reconciliations"], followUps: ["What should I review this week?"] };
  if (/tax|payroll|compensation/.test(q)) return { answer: `${context.taxes} tax estimate${context.taxes === 1 ? "" : "s"} and ${context.payroll} payroll record${context.payroll === 1 ? "" : "s"} need attention. Capture Tracker does not calculate or certify tax obligations.`, aliases: ["taxes"], followUps: ["What should I review this week?"] };
  if (/week|review|transaction/.test(q)) return { answer: `Your Weekly Review is ${context.review.review?.status?.toLowerCase() ?? "not started"}. It currently identifies ${context.review.attention.total} items needing attention, including ${context.review.attention.transactions} transactions.`, aliases: ["review"], followUps: ["What documents need attention?"] };
  return { answer: "I can summarize posted financial reports, cash activity, Weekly Review, transactions needing review, documents, reconciliation, and stored tax or payroll readiness. I cannot change records or answer this from the available structured facts.", aliases: [], limitations: "Insufficient supported data for this question.", followUps: ["How did my business perform this month?", "What should I review this week?"] };
}

export async function askAi(actor: AskAiActor, input: { question: string; conversationId?: string; refresh?: boolean }) {
  const question = clean(input.question);
  if (!question) return { ok: false as const, code: "INVALID_QUESTION" as const };
  const conversation = input.conversationId ? await prisma.askAiConversation.findFirst({ where: { id: input.conversationId, businessId: actor.businessId, archivedAt: null } }) : await prisma.askAiConversation.create({ data: { businessId: actor.businessId, createdByUserId: actor.actorUserId, title: question.slice(0, 80) } });
  if (!conversation) return { ok: false as const, code: "NOT_FOUND" as const };
  const idempotencyKey = key(conversation.id, `${question}:${input.refresh ? Date.now() : ""}`);
  const existing = await prisma.askAiRun.findFirst({ where: { businessId: actor.businessId, conversationId: conversation.id, idempotencyKey }, include: { assistantMessage: true } });
  if (existing?.assistantMessage) return { ok: true as const, state: "EXISTING" as const, conversationId: conversation.id };
  const userMessage = await prisma.askAiMessage.create({ data: { businessId: actor.businessId, conversationId: conversation.id, actorUserId: actor.actorUserId, role: "USER", content: question } });
  const run = await prisma.askAiRun.create({ data: { businessId: actor.businessId, conversationId: conversation.id, userMessageId: userMessage.id, actorUserId: actor.actorUserId, idempotencyKey, adapterId: "local-fictional", adapterVersion: "v1", status: "PROCESSING", events: { create: [{ actorUserId: actor.actorUserId, action: input.refresh ? "ANSWER_REFRESHED" : "QUESTION_SUBMITTED" }] } } });
  try {
    const context = await buildAskAiContext(actor.businessId, question); const result = localAskAiAdapter(question, context); const allowed = new Map(context.evidence.map((item) => [item.alias, item]));
    if (result.aliases.some((alias) => !allowed.has(alias))) throw new Error("INVALID_EVIDENCE");
    await prisma.$transaction(async (tx) => { await tx.askAiMessage.create({ data: { businessId: actor.businessId, conversationId: conversation.id, actorUserId: actor.actorUserId, role: "ASSISTANT", content: result.answer, runId: run.id } }); await tx.askAiEvidence.createMany({ data: result.aliases.map((alias) => { const item = allowed.get(alias)!; return { businessId: actor.businessId, runId: run.id, alias, sourceType: item.sourceType, sourceId: item.sourceId, displayLabel: item.displayLabel, route: item.route, sourceAsOf: new Date(context.asOf) }; }) }); await tx.askAiRun.update({ where: { id: run.id }, data: { status: result.blocked ? "BLOCKED" : "COMPLETED", completedAt: new Date(), evidenceAsOf: new Date(context.asOf) } }); await tx.askAiEvent.createMany({ data: [{ businessId: actor.businessId, runId: run.id, actorUserId: actor.actorUserId, action: "CONTEXT_PREPARED" }, { businessId: actor.businessId, runId: run.id, actorUserId: actor.actorUserId, action: result.blocked ? "ANSWER_BLOCKED" : "ANSWER_COMPLETED" }] }); });
    return { ok: true as const, state: result.blocked ? "BLOCKED" as const : "COMPLETED" as const, conversationId: conversation.id };
  } catch { await prisma.askAiRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), failureCode: "SAFE_ADAPTER_FAILURE" } }); await prisma.askAiEvent.create({ data: { businessId: actor.businessId, runId: run.id, actorUserId: actor.actorUserId, action: "ANSWER_FAILED", detail: "SAFE_ADAPTER_FAILURE" } }); return { ok: false as const, code: "UNAVAILABLE" as const }; }
}

export async function getAskAiConversations(businessId: string) { return prisma.askAiConversation.findMany({ where: { businessId, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 20, include: { messages: { orderBy: { createdAt: "asc" }, take: ASK_AI_LIMITS.messages, include: { run: { include: { evidence: { orderBy: { createdAt: "asc" } } } } } } } }); }
export async function recordAskAiFeedback(actor: AskAiActor, runId: string, rating: string, note?: string) { if (!["HELPFUL", "NOT_HELPFUL", "INCORRECT"].includes(rating)) return false; const run = await prisma.askAiRun.findFirst({ where: { id: runId, businessId: actor.businessId } }); if (!run) return false; await prisma.askAiFeedback.upsert({ where: { businessId_runId_actorUserId: { businessId: actor.businessId, runId, actorUserId: actor.actorUserId } }, create: { businessId: actor.businessId, runId, actorUserId: actor.actorUserId, rating, note: clean(note ?? "").slice(0, 500) || null }, update: { rating, note: clean(note ?? "").slice(0, 500) || null } }); await prisma.askAiEvent.create({ data: { businessId: actor.businessId, runId, actorUserId: actor.actorUserId, action: "FEEDBACK_RECORDED" } }); return true; }
