"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import type { TransactionDocumentActionState } from "@/app/app/money/[transactionId]/actions";

const initialState: TransactionDocumentActionState = { ok: false };

type LinkAction = (
  state: TransactionDocumentActionState,
  formData: FormData,
) => Promise<TransactionDocumentActionState>;

type DocumentItem = {
  id: string;
  displayName: string;
  originalFilename: string;
  category: string;
  documentDate: string | null;
  mimeType: string;
};

type LinkedDocument = DocumentItem & {
  linkId: string;
  attachedAt: string;
  contentHref?: string;
};

type TransactionItem = {
  id: string;
  postedAt: string;
  description: string;
  merchantName: string | null;
  amount: string;
  direction: "INFLOW" | "OUTFLOW";
  accountName: string;
};

type LinkedTransaction = TransactionItem & { linkId: string; attachedAt: string };

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(value))
    : "No document date";
}

function message(state: TransactionDocumentActionState) {
  return state.message ? <p role={state.ok ? "status" : "alert"} className={`mt-3 text-sm ${state.ok ? "text-brand-teal" : "text-red-800"}`}>{state.message}</p> : null;
}

export function TransactionDocumentsPanel({
  transactionId,
  basePath,
  linked,
  eligible,
  linkAction,
  unlinkAction,
}: {
  transactionId: string;
  basePath: "/app" | "/demo";
  linked: LinkedDocument[];
  eligible: DocumentItem[];
  linkAction?: LinkAction;
  unlinkAction?: LinkAction;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? eligible.filter((document) => `${document.displayName} ${document.originalFilename}`.toLowerCase().includes(term)) : eligible;
  }, [eligible, query]);
  const [linkState, link] = useActionState(linkAction ?? (async () => ({ ok: false, message: "Document linking is available from an authenticated workspace." })), initialState);
  const [unlinkState, unlink] = useActionState(unlinkAction ?? (async () => ({ ok: false, message: "Document linking is available from an authenticated workspace." })), initialState);
  return <section className="ui-card mt-6 p-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-bold">Documents</h2><p className="mt-1 text-sm text-text-muted">{linked.length} active linked document{linked.length === 1 ? "" : "s"}. Links never change transaction or accounting data.</p></div></div>
    {linked.length === 0 ? <p className="mt-4 text-sm text-text-muted">No active documents are linked to this transaction. Attach a clean private document below.</p> : <ul className="mt-4 divide-y divide-border-subtle">{linked.map((document) => <li key={document.linkId} className="py-4 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{document.displayName}</p><p className="mt-1 text-sm text-text-muted">{document.originalFilename} · {document.category.replaceAll("_", " ")} · {date(document.documentDate)} · {document.mimeType}</p><p className="mt-1 text-xs text-text-muted">Verified clean private document · linked {date(document.attachedAt)}</p></div><div className="flex flex-wrap gap-2"><Link className="inline-flex min-h-11 items-center rounded border border-border-subtle px-3 text-sm font-bold" href={`${basePath}/documents/${document.id}`}>Details</Link>{document.contentHref && <a className="inline-flex min-h-11 items-center rounded bg-brand-teal px-3 text-sm font-bold text-white" href={document.contentHref}>Open securely</a>}<form action={unlink}><input type="hidden" name="linkId" value={document.linkId}/><input type="hidden" name="transactionId" value={transactionId}/><input type="hidden" name="documentId" value={document.id}/><button className="min-h-11 rounded border border-border-subtle px-3 text-sm font-bold" type="submit">Unlink</button></form></div></div></li>)}</ul>}
    {message(unlinkState)}
    <div className="mt-5 border-t border-border-subtle pt-5"><h3 className="font-bold">Attach document</h3><p className="mt-1 text-sm text-text-muted">Showing up to 50 eligible active, clean documents in private storage. Search by display name or filename.</p><label className="mt-3 block text-sm font-bold">Search eligible documents<input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-input mt-1" type="search" placeholder="Receipt or filename"/></label>{filtered.length === 0 ? <p className="mt-3 text-sm text-text-muted">No eligible documents match this search. Already-linked, pending, quarantined, and non-private documents are excluded.</p> : <ul className="mt-3 divide-y divide-border-subtle">{filtered.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{document.displayName}</p><p className="text-xs text-text-muted">{document.originalFilename} · {document.category.replaceAll("_", " ")} · {date(document.documentDate)}</p></div><form action={link}><input type="hidden" name="transactionId" value={transactionId}/><input type="hidden" name="documentId" value={document.id}/><button className="min-h-11 rounded bg-brand-navy px-3 text-sm font-bold text-white" type="submit">Attach</button></form></li>)}</ul>}{message(linkState)}</div>
  </section>;
}

export function DocumentTransactionsPanel({
  documentId,
  basePath,
  linked,
  eligible,
  linkAction,
  unlinkAction,
}: {
  documentId: string;
  basePath: "/app" | "/demo";
  linked: LinkedTransaction[];
  eligible: TransactionItem[];
  linkAction?: LinkAction;
  unlinkAction?: LinkAction;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return term ? eligible.filter((transaction) => `${transaction.description} ${transaction.merchantName ?? ""}`.toLowerCase().includes(term)) : eligible; }, [eligible, query]);
  const [linkState, link] = useActionState(linkAction ?? (async () => ({ ok: false, message: "Transaction linking is available from an authenticated workspace." })), initialState);
  const [unlinkState, unlink] = useActionState(unlinkAction ?? (async () => ({ ok: false, message: "Transaction linking is available from an authenticated workspace." })), initialState);
  return <section className="ui-card p-5"><h2 className="text-lg font-bold">Linked transactions</h2><p className="mt-1 text-sm text-text-muted">{linked.length} active linked transaction{linked.length === 1 ? "" : "s"}.</p>{linked.length === 0 ? <p className="mt-4 text-sm text-text-muted">No active transactions are linked to this document. Attach it to an eligible transaction below.</p> : <ul className="mt-4 divide-y divide-border-subtle">{linked.map((transaction) => <li key={transaction.linkId} className="py-4 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{transaction.merchantName ?? transaction.description}</p><p className="mt-1 text-sm text-text-muted">{date(transaction.postedAt)} · {transaction.description} · {transaction.accountName}</p><p className="mt-1 money-value text-sm font-bold">{transaction.direction === "OUTFLOW" ? "−" : "+"}${transaction.amount}</p><p className="mt-1 text-xs text-text-muted">Linked {date(transaction.attachedAt)}</p></div><div className="flex gap-2"><Link className="inline-flex min-h-11 items-center rounded border border-border-subtle px-3 text-sm font-bold" href={`${basePath}/money/${transaction.id}`}>Open transaction</Link><form action={unlink}><input type="hidden" name="linkId" value={transaction.linkId}/><input type="hidden" name="transactionId" value={transaction.id}/><input type="hidden" name="documentId" value={documentId}/><button className="min-h-11 rounded border border-border-subtle px-3 text-sm font-bold" type="submit">Unlink</button></form></div></div></li>)}</ul>}{message(unlinkState)}<div className="mt-5 border-t border-border-subtle pt-5"><h3 className="font-bold">Attach to transaction</h3><p className="mt-1 text-sm text-text-muted">Showing up to 50 eligible non-voided transactions. Search by merchant or description.</p><label className="mt-3 block text-sm font-bold">Search eligible transactions<input value={query} onChange={(event) => setQuery(event.target.value)} className="ui-input mt-1" type="search" placeholder="Merchant or description"/></label>{filtered.length === 0 ? <p className="mt-3 text-sm text-text-muted">No eligible transactions match this search. Already-linked and voided transactions are excluded.</p> : <ul className="mt-3 divide-y divide-border-subtle">{filtered.map((transaction) => <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold">{transaction.merchantName ?? transaction.description}</p><p className="text-xs text-text-muted">{date(transaction.postedAt)} · {transaction.description} · {transaction.accountName}</p></div><form action={link}><input type="hidden" name="transactionId" value={transaction.id}/><input type="hidden" name="documentId" value={documentId}/><button className="min-h-11 rounded bg-brand-navy px-3 text-sm font-bold text-white" type="submit">Attach</button></form></li>)}</ul>}{message(linkState)}</div></section>;
}
