"use client";

import { useActionState, useEffect, useRef, useState, type ChangeEvent } from "react";

import { uploadDocument as defaultUploadDocument, type DocumentUploadState } from "@/app/app/documents/actions";
import { normalizeReceiptImage } from "@/lib/documents/receipt-image-normalizer";

const initialState: DocumentUploadState = { ok: false };

type SelectedDocument = {
  file: File;
  source: "camera" | "file";
  previewUrl: string | null;
  normalized: boolean;
};

export function DocumentUploadForm({ uploadAction = defaultUploadDocument, title = "Upload a private document", description = "Use your phone camera or select a PDF, PNG, or JPEG already on your device. Files are strictly validated, kept private, and scanned before they become available in Capture Tracker.", cameraLabel = "Take photo of receipt" }: { uploadAction?: typeof defaultUploadDocument; title?: string; description?: string; cameraLabel?: string } = {}) {
  const [state, action, pending] = useActionState(uploadAction, initialState);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const selectionVersion = useRef(0);
  const [preparing, setPreparing] = useState(false);
  const [selected, setSelected] = useState<SelectedDocument | null>(null);

  useEffect(() => {
    return () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); };
  }, []);

  async function selectFile(event: ChangeEvent<HTMLInputElement>, source: "camera" | "file") {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const input = event.currentTarget;
    const version = ++selectionVersion.current;
    setPreparing(true);
    let prepared = { file, normalized: false };
    try {
      prepared = await normalizeReceiptImage(file);
    } catch {
      // The existing server-side structural validator remains authoritative if
      // a browser cannot locally decode a selected image.
    }
    if (version !== selectionVersion.current) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    // Never let the original picker File be submitted. submitUpload adds only
    // the selected File, which is the normalized image when one was produced.
    input.value = "";
    if (source === "camera" && fileInput.current) fileInput.current.value = "";
    if (source === "file" && cameraInput.current) cameraInput.current.value = "";
    previewUrl.current = prepared.file.type.startsWith("image/") ? URL.createObjectURL(prepared.file) : null;
    setSelected({ file: prepared.file, source, previewUrl: previewUrl.current, normalized: prepared.normalized });
    setPreparing(false);
  }

  function removeSelection() {
    selectionVersion.current += 1;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    if (cameraInput.current) cameraInput.current.value = "";
    if (fileInput.current) fileInput.current.value = "";
    setPreparing(false);
    setSelected(null);
  }

  function submitUpload(formData: FormData) {
    formData.delete("cameraDocument");
    formData.delete("document");
    if (selected) formData.set(selected.source === "camera" ? "cameraDocument" : "document", selected.file, selected.file.name);
    action(formData);
  }

  const busy = pending || preparing;

  return <section id="document-upload" className="ui-card scroll-mt-6 overflow-hidden p-5 sm:p-6">
    <h2 className="text-lg font-bold">{title}</h2>
    <p className="mt-1 text-sm text-text-muted">{description}</p>
    <form action={submitUpload} className="mt-4 space-y-3">
      <input ref={cameraInput} id="receipt-camera" name="cameraDocument" type="file" accept="image/jpeg,image/png,image/*" capture="environment" disabled={busy} className="sr-only" aria-label={cameraLabel} onChange={(event) => void selectFile(event, "camera")} />
      <input ref={fileInput} id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} className="sr-only" aria-label="Choose existing document file" onChange={(event) => void selectFile(event, "file")} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="button" disabled={busy} onClick={() => cameraInput.current?.click()} className="order-1 min-h-12 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white transition hover:bg-brand-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60 sm:order-2">{cameraLabel}</button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="order-2 min-h-12 rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-4 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:opacity-60 sm:order-1">Choose existing file</button>
      </div>
      {selected ? <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-surface-secondary p-3" aria-live="polite">
        <p className="break-words text-sm font-bold text-text-primary">Selected: {selected.file.name}</p>
        <p className="mt-1 text-xs text-text-muted">Ready to upload · {formatSize(selected.file.size)}{selected.normalized ? " · Optimized for receipt reading" : ""}</p>
        {selected.previewUrl ? <>
          {/* A local object URL is intentionally not routed through Next image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mt-3 max-h-72 w-full rounded-[var(--radius-sm)] object-contain" src={selected.previewUrl} alt={`Preview of ${selected.file.name}`} />
        </> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.source === "camera" ? <button type="button" disabled={busy} onClick={() => cameraInput.current?.click()} className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong px-3 text-sm font-bold text-text-primary disabled:opacity-60">Retake photo</button> : null}
          <button type="button" disabled={busy} onClick={removeSelection} className="min-h-11 rounded-[var(--radius-sm)] border border-border-strong px-3 text-sm font-bold text-text-primary disabled:opacity-60">Remove file</button>
        </div>
      </div> : <p className="text-xs text-text-muted" aria-live="polite">{preparing ? "Preparing receipt for private upload…" : "No file selected."}</p>}
      <button type="submit" disabled={busy || !selected} className="min-h-11 rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white disabled:opacity-60">{preparing ? "Preparing receipt…" : pending ? "Validating and storing…" : "Upload securely"}</button>
    </form>
    {state.message && <p className={`mt-4 rounded p-3 text-sm ${state.ok ? "bg-[var(--brand-teal-soft)] text-brand-teal" : "bg-red-50 text-red-800"}`} role={state.ok ? "status" : "alert"}>{state.message}</p>}
    {state.ok && !state.message && <p className={`mt-4 rounded p-3 text-sm ${state.outcome === "SCAN_FAILED" ? "bg-red-50 text-red-800" : "bg-[var(--brand-teal-soft)] text-brand-teal"}`} role="status">{state.outcome === "QUARANTINED" ? "Security scan pending. The document remains private and unavailable until scanning succeeds." : state.outcome === "SCAN_FAILED" ? "We could not finish the security scan yet. The document remains private and unavailable until scanning succeeds." : "The existing canonical document was retained."}</p>}
  </section>;
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
