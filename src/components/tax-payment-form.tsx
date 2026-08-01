"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type TaxActionCode =
  | "RECORDED"
  | "ALREADY_RECORDED"
  | "IDEMPOTENCY_CONFLICT"
  | "STALE_VERSION"
  | "FUTURE_VERSION"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "SAFE_FAILURE";

export type TaxActionState = {
  code: TaxActionCode | null;
  message: string | null;
};

const initialState: TaxActionState = { code: null, message: null };

export function TaxPaymentForm({
  estimateId,
  version,
  action,
}: {
  estimateId: string;
  version: number;
  action: (state: TaxActionState, form: FormData) => Promise<TaxActionState>;
}) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [state, submit, pending] = useActionState(action, initialState);
  const resultId = "tax-payment-result";

  useEffect(() => {
    if (state.code === "RECORDED" || state.code === "ALREADY_RECORDED") {
      router.refresh();
    }
  }, [router, state.code]);

  return (
    <form action={submit} className="ui-card mt-6 grid gap-3 p-5">
      <input type="hidden" name="estimateId" value={estimateId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <div>
        <h2 className="font-bold">Record external payment</h2>
        <p className="mt-1 text-sm text-text-muted">
          Capture Tracker records payments made outside the app. It does not
          initiate a tax payment.
        </p>
      </div>
      <label className="text-sm font-bold" htmlFor="payment-amount">
        Amount
        <input
          aria-describedby={state.code ? resultId : undefined}
          className="ui-input mt-1"
          id="payment-amount"
          inputMode="decimal"
          name="amount"
          required
        />
      </label>
      <label className="text-sm font-bold" htmlFor="payment-date">
        Payment date
        <input
          aria-describedby={state.code ? resultId : undefined}
          className="ui-input mt-1"
          id="payment-date"
          name="paidAt"
          required
          type="date"
        />
      </label>
      <label className="text-sm font-bold" htmlFor="payment-note">
        Confirmation or reference (optional)
        <input aria-describedby={state.code ? resultId : undefined} className="ui-input mt-1" id="payment-reference" maxLength={160} name="confirmationNumber" />
      </label>
      <label className="text-sm font-bold" htmlFor="payment-note">
        Notes (optional)
        <textarea
          aria-describedby={state.code ? resultId : undefined}
          className="ui-input mt-1"
          id="payment-note"
          maxLength={240}
          name="notes"
        />
      </label>
      <button
        className="min-h-11 rounded-[var(--radius-sm)] bg-brand-navy px-4 font-bold text-white disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording payment…" : "Record payment"}
      </button>
      {state.code && state.message && (
        <p
          className="text-sm font-medium"
          id={resultId}
          role={state.code === "RECORDED" ? "status" : "alert"}
        >
          <span className="font-bold">{state.code.replaceAll("_", " ")}:</span>{" "}
          {state.message}
        </p>
      )}
    </form>
  );
}
