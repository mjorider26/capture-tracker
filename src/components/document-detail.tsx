import Link from "next/link";
import type { ReactNode } from "react";

import { Card, PageHeader, StatusBadge } from "./ui";

type Detail = {
  displayName: string; originalFilename: string; status: string; storageState: string; malwareScanStatus: string; retentionUntil: Date; quarantineReasonCode: string | null;
  statusHistory: Array<{ id: string; newStatus: string; createdAt: Date; reasonCode: string | null }>;
};

const display = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Los_Angeles" }).format(value);

export function DocumentDetail({ document, basePath, actions, contentHref }: { document: Detail; basePath: "/app" | "/demo"; actions?: ReactNode; contentHref?: string }) {
  const metadataOnly = document.storageState === "METADATA_ONLY";
  const readable = document.status === "ACTIVE" && !metadataOnly;
  return <section className="space-y-6">
    <Link className="inline-flex min-h-11 items-center text-sm font-bold text-brand-teal underline underline-offset-4" href={`${basePath}/documents`}>Back to Documents</Link>
    <PageHeader eyebrow={metadataOnly ? "Metadata-only record" : "Private document record"} title={document.displayName} description="Evidence is available only through authenticated, business-scoped access to private object storage." action={<StatusBadge tone={readable ? "success" : document.status === "PENDING_VALIDATION" ? "warning" : "locked"}>{readable ? "Active and private" : display(document.status)}</StatusBadge>} />
    <Card className="document-safeguards p-5 sm:p-6">
      <h2 className="text-lg font-bold text-text-primary">Document safeguards</h2>
      <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
        <div><dt className="text-text-muted">Original filename</dt><dd className="mt-1 font-semibold text-text-primary">{document.originalFilename}</dd></div>
        <div><dt className="text-text-muted">Validation</dt><dd className="mt-1"><StatusBadge tone={readable ? "success" : "locked"}>{readable ? "Active and private" : display(document.status)}</StatusBadge></dd></div>
        <div><dt className="text-text-muted">Evidence access</dt><dd className="mt-1 font-semibold text-text-primary">{metadataOnly ? "Metadata only" : contentHref ? "Protected access available" : "Protected access unavailable"}</dd></div>
        <div><dt className="text-text-muted">Malware scanning</dt><dd className="mt-1 font-semibold text-text-primary">Deferred for the private single-owner pilot</dd></div>
        <div><dt className="text-text-muted">Scheduled retention through</dt><dd className="mt-1 text-text-primary">{date(document.retentionUntil)}</dd></div>
        {document.quarantineReasonCode && <div><dt className="text-text-muted">Review reason</dt><dd className="mt-1 text-text-primary">{display(document.quarantineReasonCode)}</dd></div>}
      </dl>
      {contentHref ? <a href={contentHref} className="ui-button ui-button-primary mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-brand-teal px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--brand-teal-strong)]">Open protected document</a> : <p className="auth-note mt-6 rounded-[var(--radius-sm)] p-4 text-sm leading-6 text-text-muted">Preview and download are unavailable until an active document is available in private storage.</p>}
      {actions}
    </Card>
    <Card className="document-history p-5 sm:p-6"><h2 className="text-lg font-bold">Status history</h2><ol className="mt-5 space-y-4">{document.statusHistory.map((event) => <li key={event.id} className="border-l-2 border-brand-teal pl-4 text-sm"><p className="font-semibold text-text-primary">{display(event.newStatus)}</p><p className="mt-1 text-text-muted">{date(event.createdAt)}{event.reasonCode ? ` / ${display(event.reasonCode)}` : ""}</p></li>)}</ol></Card>
  </section>;
}
