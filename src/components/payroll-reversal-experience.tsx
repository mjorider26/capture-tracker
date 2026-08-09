"use client";

import { useActionState } from "react";
import { Card, InlineAlert } from "./ui";
import type { PayrollActionState } from "@/app/app/taxes/payroll/actions";

const initial: PayrollActionState = { status: "idle", message: null };
export function PayrollReversalExperience({ runs, action }: { runs: Array<{ id: string; payDate: string; grossWages: string }>; action: (state: PayrollActionState, formData: FormData) => Promise<PayrollActionState> }) {
  const [state, submit, pending] = useActionState(action, initial);
  if (!runs.length) return null;
  return <Card className="mt-6 p-5"><h2 className="font-bold">Correct a posted payroll result</h2><p className="mt-1 text-sm text-text-muted">This creates an immutable reversing journal. It never deletes or edits the original payroll result, and it cannot be run twice.</p><InlineAlert title="Use only for a genuine correction" tone="warning">Record a corrected payroll result separately after reversing the incorrect provider result. Capture Tracker does not run payroll or change provider filings.</InlineAlert><form action={submit} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-text-muted">Posted payroll result<select required className="ui-input mt-1" name="payrollRunId" defaultValue=""><option disabled value="">Choose a result to reverse</option>{runs.map((run) => <option key={run.id} value={run.id}>{run.payDate} · ${run.grossWages}</option>)}</select></label><label className="text-sm font-bold text-text-muted">Reversal date<input required className="ui-input mt-1" name="reversalDate" type="date" /></label><label className="sm:col-span-2 flex gap-2 text-sm"><input required name="confirmation" type="checkbox" />I confirm this is a correction and should be reversed with a new immutable journal.</label>{state.message && <p role={state.status === "error" ? "alert" : "status"} className="sm:col-span-2 text-sm font-bold">{state.message}</p>}<button disabled={pending} className="ui-button ui-button-secondary min-h-11 px-4 disabled:opacity-60">{pending ? "Reversing…" : "Reverse payroll result"}</button></form></Card>;
}
