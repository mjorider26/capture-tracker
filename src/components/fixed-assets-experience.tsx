"use client";

import { useActionState, useState } from "react";
import { Card, InlineAlert, PageHeader, StatusBadge } from "./ui";
import type { FixedAssetActionState } from "@/app/app/taxes/fixed-assets/actions";

const initial: FixedAssetActionState = { status: "idle", message: null };
type Action = (state: FixedAssetActionState, formData: FormData) => Promise<FixedAssetActionState>;
type Asset = {
  id: string; name: string; category: string; vendor: string | null; acquisitionDate: string; cost: string;
  status: "POSSIBLE_REVIEW" | "IN_SERVICE" | "DISPOSED" | "VOIDED"; version: number;
  placedInServiceDate: string | null; approvedAt: string | null; hasDocument: boolean; sourceDescription: string | null;
};
type Data = { assets: Asset[]; documents: Array<{ id: string; originalFilename: string }> };

const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
const inputDate = (value: string | null) => value?.slice(0, 10) ?? "";

function ApprovalForm({ asset, action }: { asset: Asset; action: Action }) {
  const [state, submit, pending] = useActionState(action, initial);
  return <form action={submit} className="mt-3 grid gap-3 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-secondary p-4 sm:grid-cols-2">
    <input type="hidden" name="assetId" value={asset.id} />
    <input type="hidden" name="version" value={asset.version} />
    <p className="sm:col-span-2 text-sm font-bold">Review asset</p>
    <p className="sm:col-span-2 text-sm text-text-muted">{asset.sourceDescription ?? "No source transaction linked"} · {asset.hasDocument ? "Supporting document linked" : "No supporting document linked"}</p>
    <label className="text-sm font-bold text-text-muted">Placed in service
      <input required className="ui-input mt-1" name="placedInServiceDate" type="date" defaultValue={inputDate(asset.placedInServiceDate)} />
    </label>
    <div className="flex items-end"><StatusBadge tone="info">TAX TREATMENT PENDING</StatusBadge></div>
    <label className="sm:col-span-2 flex gap-2 text-sm leading-6 text-text-primary">
      <input required name="confirmation" type="checkbox" value="on" />
      I confirm this asset was ready and available for its intended business use on the placed-in-service date shown.
    </label>
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className="sm:col-span-2 text-sm font-bold">{state.message}</p>}
    <button disabled={pending} className="ui-button ui-button-primary min-h-11 px-4 disabled:opacity-60">{pending ? "Approving…" : "Approve in service"}</button>
  </form>;
}

export function FixedAssetsExperience({ data, action, approvalAction }: { data: Data; action: Action; approvalAction: Action }) {
  const [state, submit, pending] = useActionState(action, initial);
  const [showForm, setShowForm] = useState(false);
  return <>
    <PageHeader eyebrow="Fixed assets" title="Fixed asset register" description="Capture possible business assets for owner review. Recording in-service facts does not choose a depreciation method or tax treatment." action={<button onClick={() => setShowForm(!showForm)} className="ui-button ui-button-primary min-h-11 px-4">{showForm ? "Hide asset form" : "Record possible fixed asset"}</button>} />
    <InlineAlert title="Bookkeeping and tax workpapers are separate" tone="warning">An in-service asset is a bookkeeping fact. Its tax treatment can remain a CPA review item without blocking ordinary month-end bookkeeping.</InlineAlert>
    {showForm && <form action={submit} className="ui-card mt-6 grid gap-4 p-5 sm:grid-cols-2">
      <label className="text-sm font-bold text-text-muted">Asset name<input required className="ui-input mt-1" name="name" maxLength={180} /></label>
      <label className="text-sm font-bold text-text-muted">Category<input required className="ui-input mt-1" name="category" maxLength={100} placeholder="Equipment, computer, furniture…" /></label>
      <label className="text-sm font-bold text-text-muted">Vendor (optional)<input className="ui-input mt-1" name="vendor" maxLength={180} /></label>
      <label className="text-sm font-bold text-text-muted">Acquisition date<input required className="ui-input mt-1" type="date" name="acquisitionDate" /></label>
      <label className="text-sm font-bold text-text-muted">Acquisition cost<input required className="ui-input mt-1" inputMode="decimal" name="acquisitionCost" placeholder="0.00" /></label>
      <label className="text-sm font-bold text-text-muted">Placed in service (optional)<input className="ui-input mt-1" type="date" name="placedInServiceDate" /></label>
      <label className="text-sm font-bold text-text-muted sm:col-span-2">Supporting document (optional)<select className="ui-input mt-1" name="documentId" defaultValue=""><option value="">No document linked</option>{data.documents.map((document) => <option key={document.id} value={document.id}>{document.originalFilename}</option>)}</select></label>
      <label className="text-sm font-bold text-text-muted sm:col-span-2">Business purpose / notes (optional)<textarea className="ui-input mt-1 min-h-20" name="workpaperNotes" maxLength={2000} /></label>
      <label className="text-sm font-bold text-text-muted sm:col-span-2">CPA notes (optional)<textarea className="ui-input mt-1 min-h-20" name="cpaNotes" maxLength={2000} /></label>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className="sm:col-span-2 text-sm font-bold">{state.message}</p>}
      <button disabled={pending} className="ui-button ui-button-primary min-h-11 px-4 disabled:opacity-60">{pending ? "Saving…" : "Save review workpaper"}</button>
    </form>}
    <Card className="mt-6 overflow-x-auto p-5"><h2 className="font-bold">Register</h2>
      {data.assets.length ? <div className="mt-4 space-y-4">{data.assets.map((asset) => <section className="border-t border-border-subtle pt-4" key={asset.id}>
        <div className="grid gap-3 text-sm sm:grid-cols-5"><div className="sm:col-span-2"><p className="font-bold">{asset.name}</p><p className="text-text-muted">{asset.category}{asset.vendor ? ` · ${asset.vendor}` : ""}</p></div><div><p className="text-text-muted">Acquired</p><p>{formatDate(asset.acquisitionDate)}</p></div><div><p className="text-text-muted">Cost</p><p className="money-value">${asset.cost}</p></div><div><StatusBadge tone={asset.status === "IN_SERVICE" ? "success" : "warning"}>{asset.status.replaceAll("_", " ")}</StatusBadge>{asset.status === "IN_SERVICE" && <p className="mt-2 text-xs text-text-muted">In service {asset.placedInServiceDate ? formatDate(asset.placedInServiceDate) : ""}{asset.approvedAt ? ` · Approved ${formatDate(asset.approvedAt)}` : ""}</p>}</div></div>
        {asset.status === "POSSIBLE_REVIEW" && <ApprovalForm asset={asset} action={approvalAction} />}
      </section>)}</div> : <p className="mt-3 text-sm text-text-muted">No fixed-asset workpapers recorded.</p>}
    </Card>
  </>;
}
