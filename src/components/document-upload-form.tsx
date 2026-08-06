"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";

import { uploadDocument, type DocumentUploadState } from "@/app/app/documents/actions";

const initialState: DocumentUploadState = { ok: false };

export function DocumentUploadForm() {
  const [state, action, pending] = useActionState(uploadDocument, initialState);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const [selected, setSelected] = useState<{ file: File; source: "camera" | "file"; previewUrl: string | null } | null>(null);

  useEffect(() => {
    return () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); };
  }, []);

  function selectFile(event: ChangeEvent<HTMLInputElement>, source: "camera" | "file") {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (source === "camera" && fileInput.current) fileInput.current.value = "";
    if (source === "file" && cameraInput.current) cameraInput.current.value = "";
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setSelected({ file, source, previewUrl: previewUrl.current });
  }

  function removeSelection() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    if (cameraInput.current) cameraInput.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
    setSelected(null);
  }

  return <section id="document-upload" className="ui-card scroll-mt-6 overflow-hidden p-5 sm:p-6">
    <h2 className="text-lg font-bold">Upload a private document</h2>
    <p className="mt-1 text-sm text-text-muted">Use your phone camera or select a PDF, PNG, or JPEG already on your device. Files are strictly validated and stored in private object storage. Malware scanning and quarantine are not implemented; upload only trusted receipts and documents.</p>
    <form action={action} className="mt-4 space-y-3">
      <input ref={cameraInput} id="receipt-camera" name="cameraDocument" type="file" accept="image/jpeg,image/png,image/*" capture="environment" disabled={pending} className="sr-only" aria-label="Take photo of receipt" onChange={(event) => selectFile(event, "camera")} />
      <input ref={fileInput} id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png" disabled={pending} className="sr-only" aria-label="Choose existing document file" onChange={(event) => selectFile(event, "file")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" disabled={pending} onClick={() => cameraInput.current?.click()} className="order-1 min-h-12 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white transition hover:bg-brand-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60 sm:order-2">Take photo of receipt</button>
        <button type="button" disabled={pending} onClick={() => fileInput.current?.click()} className="order-2 min-h-12 rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-4 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60 sm:order-1">Choose existing file</button>
      </div>
      {selected ? <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-secondary p-3" aria-live="polite">
        <p className="break-words text-sm font-bold text-text-primary">Selected: {selected.file.name}</p>
        {selected.previewUrl ? <>
          {/* A local object URL is intentionally not routed through Next image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mt-3 max-h-72 w-full rounded-[var(--radius-sm)] object-contain" src={selected.previewUrl} alt={`Preview of ${selected.file.name}`} />
        </> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.source === "camera" ? <button type="button" disabled={pending} onClick={() => cameraInput.current?.click()} className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong px-3 text-sm font-bold text-text-primary disabled:opacity-60">Retake photo</button> : null}
          <button type="button" disabled={pending} onClick={removeSelection} className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong px-3 text-sm font-bold text-text-primary disabled:opacity-60">Remove file</button>
        </div>
      </div> : <p className="text-xs text-text-muted" aria-live="polite">No file selected.</p>}
      <button type="submit" disabled={pending} className="min-h-11 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white disabled:opacity-60">{pending ? "Validating and storing…" : "Upload securely"}</button>
    </form>
    {state.message && <p className={`mt-4 rounded p-3 text-sm ${state.ok ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "bg-red-50 text-red-800"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    {state.ok && !state.message && <p className="mt-4 rounded bg-[var(--brand-teal-soft)] p-3 text-sm text-brand-teal" role="status">{state.outcome === "ACTIVE" ? "Validated and stored privately. The document is ready for review." : "The existing canonical document was retained."}</p>}
  </section>;
}
