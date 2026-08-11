"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { InvoiceActionState } from "@/app/app/money/invoices/actions";

import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "./ui";

const initial: InvoiceActionState = { status: "idle", message: null };
type Action = (state: InvoiceActionState, form: FormData) => Promise<InvoiceActionState>;
type Props = {
  customers: Array<{ id: string; businessName: string }>;
  accounts: Array<{ id: string; name: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; customer: string; total: string; paid: string; status: string; dueDate: string | null }>;
  customerAction: Action; invoiceAction: Action; issueAction: Action; paymentAction: Action;
  canMutate?: boolean; initialOpen?: boolean;
};

export function InvoiceCenter({ customers, accounts, invoices, customerAction, invoiceAction, issueAction, paymentAction, canMutate = true, initialOpen = false }: Props) {
  const [customer, saveCustomer, customerPending] = useActionState(customerAction, initial);
  const [invoice, saveInvoice, invoicePending] = useActionState(invoiceAction, initial);
  const [issue, submitIssue] = useActionState(issueAction, initial);
  const [payment, submitPayment] = useActionState(paymentAction, initial);
  const [show, setShow] = useState(initialOpen && canMutate);
  return <>
    <PageHeader eyebrow="Get paid" title="Invoices" description="Create service invoices, track what customers owe, and match incoming payment evidence. Capture Tracker records payments but does not process them." action={canMutate ? <button className="ui-button ui-button-primary min-h-11 px-4" onClick={() => setShow(!show)}>{show ? "Hide forms" : "Create invoice"}</button> : <StatusBadge tone="locked">Read-only professional review</StatusBadge>} />
    {show && canMutate ? <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form action={saveCustomer} className="ui-card grid gap-3 p-5"><h2 className="font-bold">New customer</h2><Field label="Business/customer name"><input required className="ui-input mt-1" name="businessName" /></Field><Field label="Contact name"><input className="ui-input mt-1" name="contactName" /></Field><Field label="Email"><input className="ui-input mt-1" name="email" type="email" /></Field>{customer.message ? <p role={customer.status === "error" ? "alert" : "status"} className="text-sm font-bold">{customer.message}</p> : null}<button disabled={customerPending} className="ui-button ui-button-secondary min-h-11 px-4">Save customer</button></form>
      <form action={saveInvoice} className="ui-card grid gap-3 p-5"><h2 className="font-bold">New invoice</h2><Field label="Customer"><select required className="ui-input mt-1" name="customerId" defaultValue=""><option value="" disabled>Select customer</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.businessName}</option>)}</select></Field><Field label="Service description"><input required className="ui-input mt-1" name="description" /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Quantity"><input required className="ui-input mt-1" name="quantity" defaultValue="1" inputMode="decimal" /></Field><Field label="Rate"><input required className="ui-input mt-1" name="rate" inputMode="decimal" /></Field><Field label="Issue date"><input required className="ui-input mt-1" name="issueDate" type="date" /></Field><Field label="Due date"><input required className="ui-input mt-1" name="dueDate" type="date" /></Field></div><Field label="Payment instructions"><textarea className="ui-input mt-1" name="paymentInstructions" /></Field>{invoice.message ? <p role={invoice.status === "error" ? "alert" : "status"} className="text-sm font-bold">{invoice.message}</p> : null}<button disabled={invoicePending} className="ui-button ui-button-primary min-h-11 px-4">Create draft</button></form>
    </div> : null}
    <Card className="mt-6 p-5"><h2 className="font-bold">Invoice register</h2>{invoices.length ? <div className="mt-3 space-y-3">{invoices.map((item) => <section key={item.id} className="border-t border-border-subtle pt-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{item.invoiceNumber} · {item.customer}</p><p className="money-value text-sm">${item.total} · ${item.paid} received{item.dueDate ? ` · Due ${item.dueDate}` : ""}</p></div><div className="flex items-center gap-3"><StatusBadge tone={item.status === "PAID" ? "success" : "warning"}>{item.status.replaceAll("_", " ")}</StatusBadge>{canMutate && item.status === "DRAFT" ? <form action={submitIssue}><input type="hidden" name="invoiceId" value={item.id}/><button className="ui-button ui-button-secondary min-h-10 px-3">Issue</button></form> : null}</div></div>{canMutate && ["ISSUED", "OVERDUE", "PARTIALLY_PAID"].includes(item.status) ? <details className="mt-3"><summary className="cursor-pointer text-sm font-bold text-brand-navy">Record payment</summary><form action={submitPayment} className="mt-3 grid gap-3 sm:grid-cols-4"><input type="hidden" name="invoiceId" value={item.id}/><Field label="Amount"><input required className="ui-input mt-1" name="amount" inputMode="decimal"/></Field><Field label="Received"><input required className="ui-input mt-1" name="receivedAt" type="date"/></Field><Field label="Deposit account"><select className="ui-input mt-1" name="financialAccountId" defaultValue=""><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Reference"><input className="ui-input mt-1" name="reference" maxLength={500}/></Field><button className="ui-button ui-button-primary min-h-11 px-3 sm:col-span-4">Record owner-confirmed payment</button></form></details> : null}</section>)}</div> : <EmptyState title="No invoices yet"><span>Create a professional service invoice to track what a customer owes, then match the incoming payment when it appears.</span>{canMutate ? <ButtonLink className="mt-4" href="/app/money/invoices?new=invoice">Create invoice</ButtonLink> : null}</EmptyState>}{issue.message ? <p className="mt-4 text-sm font-bold">{issue.message}</p> : null}{payment.message ? <p className="mt-4 text-sm font-bold">{payment.message}</p> : null}<div className="mt-5 flex flex-wrap gap-4 border-t border-border-subtle pt-4 text-sm"><Link className="ui-link font-bold" href="/app/reports/operations?report=ar-aging">Who still owes me money? →</Link><Link className="ui-link font-bold" href="/app/money">Review possible payment activity →</Link></div></Card>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-sm font-bold text-text-muted">{label}{children}</label>; }
