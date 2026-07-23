"use client";

import { useActionState, useMemo, useState } from "react";

import type { ReviewActionState } from "@/lib/services/review-transaction-action";

type Split = { intent: "BUSINESS" | "PERSONAL"; amount: string; memo: string };
function cents(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{0,2})?$/.test(value)) return null;
  const [whole, fractional = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fractional.padEnd(2, "0"));
}
function formatCents(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
export function TransactionReviewForm({
  transactionId,
  version,
  amount,
  initialSplits,
  action,
}: {
  transactionId: string;
  version: number;
  amount: string;
  initialSplits: Split[];
  action: (
    state: ReviewActionState,
    formData: FormData,
  ) => Promise<ReviewActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
    message: null,
  });
  const [intent, setIntent] = useState<"BUSINESS" | "PERSONAL" | "MIXED">(
    "BUSINESS",
  );
  const [splits, setSplits] = useState<Split[]>(
    initialSplits.length >= 2
      ? initialSplits
      : [
          { intent: "BUSINESS", amount: "", memo: "" },
          { intent: "PERSONAL", amount: "", memo: "" },
        ],
  );
  const totals = useMemo(
    () =>
      splits.reduce<bigint | null>(
        (total, split) =>
          total === null || cents(split.amount) === null
            ? null
            : total + cents(split.amount)!,
        BigInt(0),
      ),
    [splits],
  );
  const parentCents = cents(amount);
  const matches =
    totals !== null && parentCents !== null && totals === parentCents;
  const update = (index: number, patch: Partial<Split>) =>
    setSplits((current) =>
      current.map((split, currentIndex) =>
        currentIndex === index ? { ...split, ...patch } : split,
      ),
    );
  return (
    <form
      action={formAction}
      className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0] sm:p-6"
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input
        type="hidden"
        name="splitCount"
        value={intent === "MIXED" ? splits.length : 0}
      />
      <fieldset>
        <legend className="text-lg font-bold">Review this transaction</legend>
        <p className="mt-1 text-sm text-[#63738a]">
          Choose how this activity should be treated. This workflow does not
          create journal entries.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(["BUSINESS", "PERSONAL", "MIXED"] as const).map((choice) => (
            <label
              key={choice}
              className={`min-h-20 rounded-xl border p-3 ${intent === choice ? "border-[#155eef] bg-[#eef4ff]" : "border-[#cbd7e6]"}`}
            >
              <input
                className="mr-2"
                type="radio"
                name="intent"
                value={choice}
                checked={intent === choice}
                onChange={() => setIntent(choice)}
              />{" "}
              <span className="font-bold">
                {choice[0] + choice.slice(1).toLowerCase()}
              </span>
              <span className="mt-1 block text-xs text-[#63738a]">
                {choice === "BUSINESS"
                  ? "Approve as business activity."
                  : choice === "PERSONAL"
                    ? "Exclude from bookkeeping."
                    : "Approve with exact business and personal splits."}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {intent === "MIXED" && (
        <section className="mt-5 border-t border-[#edf1f6] pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h3 className="font-bold">Exact mixed-purpose splits</h3>
              <p className="mt-1 text-sm text-[#63738a]">
                Parent amount: {amount}. Total:{" "}
                {totals === null ? "invalid" : formatCents(totals)}.{" "}
                {matches
                  ? "Matches exactly."
                  : parentCents !== null && totals !== null
                    ? `Remaining difference: ${formatCents(parentCents - totals)}.`
                    : "Enter valid decimal amounts."}
              </p>
            </div>
            <button
              type="button"
              disabled={splits.length >= 12}
              onClick={() =>
                setSplits((current) => [
                  ...current,
                  { intent: "BUSINESS", amount: "", memo: "" },
                ])
              }
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-[#155eef] underline disabled:text-[#9aa9ba]"
            >
              Add split
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {splits.map((split, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-xl border border-[#dce5f0] p-3 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <label className="text-sm font-semibold">
                  Purpose
                  <select
                    name={`split-intent-${index}`}
                    value={split.intent}
                    onChange={(event) =>
                      update(index, {
                        intent: event.target.value as Split["intent"],
                      })
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd7e6] bg-white px-2"
                  >
                    <option value="BUSINESS">Business</option>
                    <option value="PERSONAL">Personal</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Amount
                  <input
                    aria-describedby="split-help"
                    name={`split-amount-${index}`}
                    inputMode="decimal"
                    value={split.amount}
                    onChange={(event) =>
                      update(index, { amount: event.target.value })
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd7e6] px-2"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Memo (optional)
                  <input
                    name={`split-memo-${index}`}
                    value={split.memo}
                    onChange={(event) =>
                      update(index, { memo: event.target.value })
                    }
                    className="mt-1 min-h-11 w-full rounded-lg border border-[#cbd7e6] px-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={splits.length <= 2}
                  onClick={() =>
                    setSplits((current) =>
                      current.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    )
                  }
                  className="self-end min-h-11 text-sm font-bold text-[#155eef] underline disabled:text-[#9aa9ba]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p id="split-help" className="mt-2 text-xs text-[#6c7b90]">
            Amounts must be positive decimal strings with no more than two
            fractional digits.
          </p>
        </section>
      )}
      {state.status !== "idle" && (
        <p
          role="status"
          className={`mt-5 rounded-xl p-3 text-sm font-semibold ${state.status === "success" ? "bg-[#e7f9fb] text-[#126676]" : "bg-[#fff4e5] text-[#8a4b00]"}`}
        >
          {state.message}
        </p>
      )}
      <button
        disabled={pending || (intent === "MIXED" && !matches)}
        className="mt-5 min-h-11 rounded-xl bg-[#155eef] px-4 text-sm font-bold text-white disabled:bg-[#9aa9ba]"
      >
        {pending ? "Saving review…" : "Save review"}
      </button>
    </form>
  );
}
