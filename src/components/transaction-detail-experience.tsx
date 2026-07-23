import Link from "next/link";

import type { TransactionDetail } from "@/lib/data/transaction-detail";

import { TransactionReviewForm } from "./transaction-review-form";
import type { ReviewActionState } from "@/lib/services/review-transaction-action";

export function TransactionDetailExperience({
  detail,
  basePath,
  action,
}: {
  detail: TransactionDetail;
  basePath: "/app" | "/demo";
  action: (
    state: ReviewActionState,
    formData: FormData,
  ) => Promise<ReviewActionState>;
}) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(detail.postedAt));
  return (
    <>
      <Link
        href={`${basePath}/money`}
        className="inline-flex min-h-11 items-center text-sm font-bold text-[#155eef] underline"
      >
        ← Back to Money
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#155eef]">
            Transaction detail
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {detail.description}
          </h1>
          <p className="mt-2 text-sm text-[#63738a]">
            {date} · {detail.account.name} ·{" "}
            {detail.account.ownership.toLowerCase()} account
          </p>
        </div>
        <p className="text-2xl font-bold">
          {detail.direction === "OUTFLOW" ? "−" : "+"}
          {detail.amount}
        </p>
      </header>
      <section className="mt-6 grid gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0] sm:grid-cols-2">
        <Info label="Intent" value={detail.intent} />
        <Info
          label="Review status"
          value={detail.status.replaceAll("_", " ")}
        />
        <Info
          label="Source reference"
          value={detail.sourceReference ?? "Not available"}
        />
        <Info
          label="Supporting records"
          value={`${detail.documentCount} document${detail.documentCount === 1 ? "" : "s"} · ${detail.reimbursementCount} reimbursement link${detail.reimbursementCount === 1 ? "" : "s"}`}
        />
        <Info
          label="Accounting status"
          value={detail.journalStatus ?? "No journal entry"}
        />
        <Info
          label="Account type"
          value={detail.account.type.replaceAll("_", " ")}
        />
      </section>
      {detail.splits.length > 0 && (
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#dce5f0]">
          <h2 className="font-bold">Current splits</h2>
          <ul className="mt-3 space-y-2">
            {detail.splits.map((split) => (
              <li key={split.id} className="flex justify-between text-sm">
                <span>
                  {split.intent.toLowerCase()}{" "}
                  {split.memo ? `· ${split.memo}` : ""}
                </span>
                <span className="font-bold">${split.amount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {detail.editable ? (
        <TransactionReviewForm
          transactionId={detail.id}
          version={detail.version}
          amount={detail.amountDecimal}
          initialSplits={detail.splits.map((split) => ({
            intent: split.intent,
            amount: split.amount,
            memo: split.memo ?? "",
          }))}
          action={action}
        />
      ) : (
        <section className="mt-6 rounded-2xl border border-[#f0d5ab] bg-[#fffaf0] p-5">
          <h2 className="font-bold text-[#8a4b00]">Read-only record</h2>
          <p className="mt-2 text-sm leading-6 text-[#8a4b00]">
            {detail.lockExplanation}
          </p>
        </section>
      )}
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#6c7b90]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#10233f]">{value}</p>
    </div>
  );
}
