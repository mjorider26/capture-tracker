"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { ManualTransactionEntryOptions } from "@/lib/data/manual-transaction-entry";
import type { TransactionDetail } from "@/lib/data/transaction-detail";

export type TransactionCorrectionActionState = { status: "idle" | "success" | "error" | "conflict"; message: string | null; transactionId?: string };

const initialState: TransactionCorrectionActionState = { status: "idle", message: null };

function initialType(detail: TransactionDetail): "INCOME" | "BUSINESS_EXPENSE" | "PERSONAL" | "MIXED" {
  if (detail.intent === "PERSONAL") return "PERSONAL";
  if (detail.intent === "MIXED") return "MIXED";
  return detail.direction === "INFLOW" ? "INCOME" : "BUSINESS_EXPENSE";
}

export function TransactionCorrectionForm({ detail, options, basePath, action }: { detail: TransactionDetail; options: ManualTransactionEntryOptions; basePath: "/app"; action: (state: TransactionCorrectionActionState, formData: FormData) => Promise<TransactionCorrectionActionState> }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [state, submit, pending] = useActionState(action, initialState);
  const [type, setType] = useState(initialType(detail));
  const [cashDirection, setCashDirection] = useState<"INFLOW" | "OUTFLOW">(detail.direction);
  const key = useCorrectionKey();
  const needsCategory = type !== "PERSONAL";
  const needsDirection = type === "PERSONAL" || type === "MIXED";
  const categories = type === "INCOME" || (type === "MIXED" && cashDirection === "INFLOW") ? options.incomeCategories : options.expenseCategories;
  const initialBusiness = detail.splits.find((split) => split.intent === "BUSINESS")?.amount ?? "";
  const initialPersonal = detail.splits.find((split) => split.intent === "PERSONAL")?.amount ?? "";
  useEffect(() => { if (!state.transactionId) return; const timeout = window.setTimeout(() => router.push(`${basePath}/money/${state.transactionId}`), 500); return () => window.clearTimeout(timeout); }, [basePath, router, state.transactionId]);
  if (!started) return <section className="ui-card mt-6 p-5"><h2 className="font-bold">Correct this transaction</h2><p className="mt-2 text-sm leading-6 text-text-muted">The original transaction and its posted journal remain permanently in history. This creates an exact reversal and a new replacement record.</p><button type="button" onClick={() => setStarted(true)} className="mt-4 min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white">Correct transaction</button></section>;
  return <form action={submit} className="ui-card mt-6 p-5 sm:p-6">
    <input type="hidden" name="transactionId" value={detail.id}/><input type="hidden" name="expectedVersion" value={detail.version}/><input type="hidden" name="correctionKey" value={key}/>
    <h2 className="font-bold">Correct transaction</h2><p className="mt-1 text-sm leading-6 text-text-muted">Review the replacement values below. Posting creates immutable reversal and replacement journals; it never overwrites the original record.</p>
    <fieldset className="mt-5"><legend className="text-sm font-bold">Classification</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{([['INCOME', 'Income / deposit'], ['BUSINESS_EXPENSE', 'Business expense'], ['PERSONAL', 'Personal activity'], ['MIXED', 'Mixed business / personal']] as const).map(([value, label]) => <label key={value} className={`rounded border p-3 text-sm ${type === value ? 'border-brand-teal bg-[var(--brand-teal-soft)]' : 'border-border-subtle'}`}><input className="mr-2" type="radio" name="transactionType" value={value} checked={type === value} onChange={() => setType(value)}/><span className="font-bold">{label}</span></label>)}</div></fieldset>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold text-text-muted">Transaction date<input required className="ui-input mt-1" name="transactionDate" type="date" defaultValue={detail.postedAt.slice(0, 10)}/></label>
      <label className="text-sm font-bold text-text-muted">Exact amount<input required className="ui-input mt-1" name="amount" inputMode="decimal" defaultValue={detail.amountDecimal}/></label>
      <label className="text-sm font-bold text-text-muted">Merchant or payer<input required className="ui-input mt-1" name="merchantOrPayer" maxLength={160} defaultValue={detail.merchantName ?? ""}/></label>
      <label className="text-sm font-bold text-text-muted">Description<input required className="ui-input mt-1" name="description" maxLength={500} defaultValue={detail.description}/></label>
      {needsDirection && <label className="text-sm font-bold text-text-muted">Cash flow<select className="ui-input mt-1" name="cashDirection" value={cashDirection} onChange={(event) => setCashDirection(event.target.value as "INFLOW" | "OUTFLOW")}><option value="OUTFLOW">Money went out</option><option value="INFLOW">Money came in</option></select></label>}
      {needsCategory && <label className="text-sm font-bold text-text-muted">{type === "INCOME" || (type === "MIXED" && cashDirection === "INFLOW") ? "Income category" : "Expense category"}<select required className="ui-input mt-1" name="categoryAccountId" defaultValue={detail.journal?.categoryAccountId ?? ""}><option disabled value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
      <label className="text-sm font-bold text-text-muted">Reference<input className="ui-input mt-1" name="reference" maxLength={160} defaultValue={detail.sourceReference ?? ""}/></label>
      <label className="text-sm font-bold text-text-muted">Correction reason<input required className="ui-input mt-1" name="correctionReason" maxLength={240}/></label>
    </div>
    {type === "MIXED" && <section className="mt-5 rounded-[var(--radius-md)] bg-surface-secondary p-4"><h3 className="font-bold">Business / personal split</h3><p className="mt-1 text-sm text-text-muted">The exact portions must equal the replacement amount. Personal portions post to owner equity, never business expense.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-text-muted">Business amount<input required className="ui-input mt-1" name="businessAmount" inputMode="decimal" defaultValue={initialBusiness}/></label><label className="text-sm font-bold text-text-muted">Personal amount<input required className="ui-input mt-1" name="personalAmount" inputMode="decimal" defaultValue={initialPersonal}/></label></div></section>}
    <label className="mt-5 block text-sm font-bold text-text-muted">Notes<textarea className="ui-input mt-1 min-h-24 py-2" name="notes" maxLength={1000} defaultValue={detail.notes ?? ""}/></label>
    {state.message && <p role={state.status === "success" ? "status" : "alert"} className="mt-4 text-sm font-semibold">{state.message}</p>}
    <div className="mt-5 flex gap-3"><button disabled={pending} className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70">{pending ? "Posting correction…" : "Post correction"}</button><button disabled={pending} type="button" onClick={() => setStarted(false)} className="min-h-11 rounded border border-border-subtle px-4 text-sm font-bold">Cancel</button></div>
  </form>;
}

function useCorrectionKey() { const [key] = useState(() => crypto.randomUUID()); return key; }
