"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ManualTransactionEntryOptions } from "@/lib/data/manual-transaction-entry";

export type ManualTransactionActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  transactionId?: string;
};

const initialState: ManualTransactionActionState = { status: "idle", message: null };

export function ManualTransactionForm({
  options,
  basePath,
  action,
}: {
  options: ManualTransactionEntryOptions;
  basePath: "/app" | "/demo";
  action: (state: ManualTransactionActionState, formData: FormData) => Promise<ManualTransactionActionState>;
}) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(action, initialState);
  const idempotencyKey = useStableKey();
  const [type, setType] = useState<"INCOME" | "BUSINESS_EXPENSE" | "PERSONAL" | "MIXED">("INCOME");
  const [cashDirection, setCashDirection] = useState<"INFLOW" | "OUTFLOW">("OUTFLOW");
  const categories = type === "INCOME" || (type === "MIXED" && cashDirection === "INFLOW") ? options.incomeCategories : options.expenseCategories;
  const categoryLabel = type === "INCOME" || (type === "MIXED" && cashDirection === "INFLOW") ? "Income category" : "Expense category";
  const needsCategory = type !== "PERSONAL";
  const needsDirection = type === "PERSONAL" || type === "MIXED";
  const heading = useMemo(() => type === "MIXED" ? "Exact mixed classification" : "Manual transaction", [type]);

  useEffect(() => {
    if (!state.transactionId) return;
    const timeout = window.setTimeout(() => router.push(`${basePath}/money/${state.transactionId}`), 650);
    return () => window.clearTimeout(timeout);
  }, [basePath, router, state.transactionId]);

  return (
    <form action={submit} className="ui-card mx-auto max-w-3xl p-5 sm:p-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div>
        <p className="text-sm font-bold text-brand-teal">Money</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{heading}</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">Creates a posted, balanced journal entry immediately. Owner distributions remain equity activity, never deductible business expenses.</p>
      </div>
      <fieldset className="mt-6">
        <legend className="text-sm font-bold text-text-primary">Transaction type</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {([
            ["INCOME", "Income / deposit", "Business income received"],
            ["BUSINESS_EXPENSE", "Business expense", "A business payment"],
            ["PERSONAL", "Personal activity", "Owner contribution or distribution"],
            ["MIXED", "Mixed business / personal", "Exact business and personal portions"],
          ] as const).map(([value, label, detail]) => (
            <label key={value} className={`rounded-[var(--radius-md)] border p-3 text-sm ${type === value ? "border-brand-teal bg-[var(--brand-teal-soft)]" : "border-border-subtle"}`}>
              <input className="mr-2" type="radio" name="transactionType" value={value} checked={type === value} onChange={() => setType(value)} />
              <span className="font-bold">{label}</span><span className="mt-1 block text-xs text-text-muted">{detail}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-text-muted">Transaction date<input required className="ui-input mt-1" name="transactionDate" type="date" /></label>
        <label className="text-sm font-bold text-text-muted">Exact amount<input required className="ui-input mt-1" inputMode="decimal" name="amount" placeholder="0.00" /></label>
        <label className="text-sm font-bold text-text-muted">Merchant or payer<input required className="ui-input mt-1" maxLength={160} name="merchantOrPayer" /></label>
        <label className="text-sm font-bold text-text-muted">Description<input required className="ui-input mt-1" maxLength={500} name="description" /></label>
        <label className="text-sm font-bold text-text-muted">Cash account<select required className="ui-input mt-1" name="financialAccountId" defaultValue=""><option disabled value="">Choose account</option>{options.cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        {needsDirection && <label className="text-sm font-bold text-text-muted">Cash flow<select className="ui-input mt-1" name="cashDirection" value={cashDirection} onChange={(event) => setCashDirection(event.target.value as "INFLOW" | "OUTFLOW")}><option value="OUTFLOW">Money went out</option><option value="INFLOW">Money came in</option></select></label>}
        {needsCategory && <label className="text-sm font-bold text-text-muted">{categoryLabel}<select required className="ui-input mt-1" name="categoryAccountId" defaultValue=""><option disabled value="">Choose category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}
        <label className="text-sm font-bold text-text-muted">Reference (optional)<input className="ui-input mt-1" maxLength={160} name="reference" /></label>
      </div>
      {type === "MIXED" && <section className="mt-5 rounded-[var(--radius-md)] bg-surface-secondary p-4"><h2 className="font-bold">Business / personal split</h2><p className="mt-1 text-sm text-text-muted">Both positive portions must total the exact transaction amount.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-text-muted">Business amount<input required className="ui-input mt-1" inputMode="decimal" name="businessAmount" placeholder="0.00" /></label><label className="text-sm font-bold text-text-muted">Personal amount<input required className="ui-input mt-1" inputMode="decimal" name="personalAmount" placeholder="0.00" /></label></div></section>}
      <label className="mt-5 block text-sm font-bold text-text-muted">Notes (optional)<textarea className="ui-input mt-1 min-h-24 py-2" maxLength={1000} name="notes" /></label>
      {state.message && <p className={`mt-5 rounded-[var(--radius-md)] p-3 text-sm font-semibold ${state.status === "success" ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"}`} role={state.status === "success" ? "status" : "alert"}>{state.message}</p>}
      <div className="mt-5 flex flex-wrap gap-3"><button disabled={pending || options.cashAccounts.length === 0} className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70">{pending ? "Saving transaction…" : "Save transaction"}</button><button type="button" onClick={() => router.push(`${basePath}/money`)} className="min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-4 text-sm font-bold text-text-primary">Cancel</button></div>
    </form>
  );
}

function useStableKey() {
  const [key] = useState(() => crypto.randomUUID());
  return key;
}
