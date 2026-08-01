import Link from "next/link";

import type { TransactionDetail } from "@/lib/data/transaction-detail";

import { TransactionReviewForm } from "./transaction-review-form";
import { Card, InlineAlert } from "./ui";
import type { ReviewActionState } from "@/lib/services/review-transaction-action";
import type { ManualTransactionEntryOptions } from "@/lib/data/manual-transaction-entry";
import { TransactionCorrectionForm, type TransactionCorrectionActionState } from "./transaction-correction-form";

export function TransactionDetailExperience({
  detail,
  basePath,
  action,
  correctionOptions,
  correctionAction,
}: {
  detail: TransactionDetail;
  basePath: "/app" | "/demo";
  action: (
    state: ReviewActionState,
    formData: FormData,
  ) => Promise<ReviewActionState>;
  correctionOptions?: ManualTransactionEntryOptions;
  correctionAction?: (state: TransactionCorrectionActionState, formData: FormData) => Promise<TransactionCorrectionActionState>;
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
        className="inline-flex min-h-11 items-center text-sm font-bold text-brand-teal underline underline-offset-4"
      >
        ← Back to Money
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold tracking-wide text-brand-teal">
            Transaction detail
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {detail.description}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {date} · {detail.account.name} ·{" "}
            {detail.account.ownership.toLowerCase()} account
          </p>
        </div>
        <p className="money-value text-2xl font-bold text-brand-navy">
          {detail.direction === "OUTFLOW" ? "−" : "+"}
          {detail.amount}
        </p>
      </header>
      <Card className="mt-6 grid gap-3 p-5 sm:grid-cols-2">
        <Info label="Intent" value={detail.intent} />
        <Info
          label="Review status"
          value={detail.status.replaceAll("_", " ")}
        />
        <Info
          label="Source reference"
          value={detail.sourceReference ?? "Not available"}
        />
        <Info label="Classification" value={detail.intent.replaceAll("_", " ")} />
        <Info label="Category" value={detail.journal?.categories.join(" · ") || "Not available"} />
        <Info
          label="Supporting records"
          value={`${detail.documentCount} document${detail.documentCount === 1 ? "" : "s"} · ${detail.reimbursementCount} reimbursement link${detail.reimbursementCount === 1 ? "" : "s"}`}
        />
        <Info
          label="Accounting status"
          value={detail.journal ? `${detail.journal.entryNumber} · ${detail.journal.status}` : "No journal entry"}
        />
        <Info
          label="Account type"
          value={detail.account.type.replaceAll("_", " ")}
        />
      </Card>
      {detail.notes && <Card className="mt-5 p-5"><h2 className="font-bold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{detail.notes}</p></Card>}
      {detail.journal && <p className="mt-4 text-sm"><Link className="font-bold text-brand-teal underline underline-offset-4" href={`${basePath}/money/journal/${detail.journal.id}`}>Open journal entry {detail.journal.entryNumber}</Link></p>}
      {detail.journal?.reversal && <p className="mt-2 text-sm font-semibold text-text-muted">Reversed by <Link className="text-brand-teal underline underline-offset-4" href={`${basePath}/money/journal/${detail.journal.reversal.id}`}>{detail.journal.reversal.entryNumber}</Link>. The original accounting history is retained.</p>}
      {detail.correction.original && <p className="mt-2 text-sm font-semibold text-text-muted">Replacement of <Link className="text-brand-teal underline underline-offset-4" href={`${basePath}/money/${detail.correction.original.id}`}>the original transaction</Link>. The original record remains in history.</p>}
      {detail.correction.replacement && <p className="mt-2 text-sm font-semibold text-text-muted">This transaction was corrected. <Link className="text-brand-teal underline underline-offset-4" href={`${basePath}/money/${detail.correction.replacement.id}`}>Open the current replacement record</Link>.</p>}
      {detail.correction.reversal && <p className="mt-2 text-sm font-semibold text-text-muted">Correction reversal: <Link className="text-brand-teal underline underline-offset-4" href={`${basePath}/money/journal/${detail.correction.reversal.id}`}>{detail.correction.reversal.entryNumber}</Link>.</p>}
      {detail.correction.reason && <Card className="mt-5 p-5"><h2 className="font-bold">Correction summary</h2><p className="mt-2 text-sm text-text-muted">{detail.correction.reason}</p></Card>}
      {detail.correction.events.length > 0 && <Card className="mt-5 p-5"><h2 className="font-bold">Correction history</h2><ol className="mt-3 space-y-2 text-sm text-text-muted">{detail.correction.events.map((event, index) => <li key={`${event.occurredAt}-${index}`}>{new Date(event.occurredAt).toLocaleString()} · {event.action === "SUPERSEDE" ? "Original record superseded" : "Replacement record created"}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ol></Card>}
      {detail.splits.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="font-bold">Current splits</h2>
          <ul className="mt-3 space-y-2">
            {detail.splits.map((split) => (
              <li key={split.id} className="flex justify-between text-sm">
                <span>
                  {split.intent.toLowerCase()}{" "}
                  {split.memo ? `· ${split.memo}` : ""}
                </span>
                <span className="money-value font-bold">${split.amount}</span>
              </li>
            ))}
          </ul>
        </Card>
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
      ) : detail.correctionEligible && correctionAction && correctionOptions ? (
        <TransactionCorrectionForm detail={detail} options={correctionOptions} basePath="/app" action={correctionAction}/>
      ) : (
        <div className="mt-6">
          <InlineAlert tone="locked" title="Read-only record">
            {detail.lockExplanation}
          </InlineAlert>
        </div>
      )}
    </>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}
