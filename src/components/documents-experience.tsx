import Link from "next/link";
import type { ReactNode } from "react";

import { documentPipelinePresentation, documentValidationPresentation, documentWorkspaceMetrics, humanize } from "@/lib/documents/workspace-presentation";

import { EmptyState, PageHeader, StatusBadge } from "./ui";

type DocumentRow = {
  id: string;
  displayName: string;
  originalFilename: string;
  category: string;
  status: string;
  sizeBytes: bigint;
  retentionUntil: Date;
  documentDate: Date | null;
  malwareScanStatus: string;
  transactions: Array<{ id: string }>;
  extractionAttempts: Array<{ status: string; candidates: Array<{ reviewState: string }> }>;
  matchRuns: Array<{ status: string; suggestions: Array<{ id: string }> }>;
};

const formatSize = (value: bigint) => {
  const bytes = Number(value);
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const shortDate = (value: Date | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(value) : "No document date";

export function DocumentsExperience({
  documents,
  basePath,
  action,
}: {
  documents: DocumentRow[];
  basePath: "/app" | "/demo";
  action?: ReactNode;
}) {
  const metrics = documentWorkspaceMetrics(documents.map((document) => ({
    status: document.status,
    malwareScanStatus: document.malwareScanStatus,
    activeLinkCount: document.transactions.length,
  })));
  const attentionDocuments = documents.filter((document) => documentAttention(document).length > 0);
  const attentionItems = documents.flatMap((document) => documentAttention(document).map((reason) => ({ document, reason }))).slice(0, 5);

  return (
    <section className="space-y-7">
      <PageHeader
        eyebrow="Documents workspace"
        title="Evidence, review, and protection"
        description="Keep document evidence private, reviewable, and deliberately linked. Extraction and match suggestions never change accounting automatically."
        action={action}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Document lifecycle summary">
        <Metric label="Needs attention" value={attentionDocuments.length} detail={`${metrics.pending} awaiting validation`} emphasis={attentionDocuments.length > 0} />
        <Metric label="Active evidence" value={metrics.active} detail="Available only through protected access" />
        <Metric label="Linked evidence" value={metrics.linked} detail="Documents with an active transaction link" />
        <Metric label="Document records" value={documents.length} detail="Private business-scoped records" />
      </section>

      {attentionItems.length > 0 && <section className="ui-panel border border-[var(--warning)]/25 p-5 sm:p-6" aria-labelledby="document-attention-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--warning)]">Attention queue</p><h2 id="document-attention-heading" className="mt-1 text-lg font-bold">Documents needing a deliberate next step</h2></div><span className="text-xs text-text-muted">Showing {attentionItems.length} highest-priority items</span></div>
        <ul className="mt-4 divide-y divide-border-subtle">{attentionItems.map(({ document, reason }, index) => <li key={`${document.id}-${reason}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><div><Link className="font-bold text-brand-navy underline decoration-brand-teal underline-offset-4" href={`${basePath}/documents/${document.id}`}>{document.displayName}</Link><p className="mt-1 text-sm text-text-muted">{reason}</p></div><span className="ui-status-badge bg-[var(--warning-soft)] text-[var(--warning)]">Action needed</span></li>)}</ul>
      </section>}

      <section className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-text-primary">Document pipeline</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">Validation, extraction, suggested matches, and links remain explicit review steps.</p>
          </div>
          <span className="ui-status-badge bg-surface-secondary text-text-muted">{documents.length} records</span>
        </div>
        {documents.length === 0 ? (
          <EmptyState title="No document records yet">Upload a PDF, PNG, or JPEG to add private evidence for this business.</EmptyState>
        ) : (
          <>
            <div className="divide-y divide-border-subtle min-[720px]:hidden">
              {documents.map((document) => <DocumentCard key={document.id} document={document} basePath={basePath} />)}
            </div>
            <table className="hidden w-full text-left text-sm min-[720px]:table">
              <thead className="bg-surface-secondary text-xs uppercase tracking-[0.1em] text-text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Document</th>
                  <th className="px-5 py-3 font-bold">Validation</th>
                  <th className="px-5 py-3 font-bold">Extraction</th>
                  <th className="px-5 py-3 font-bold">Match</th>
                  <th className="px-5 py-3 font-bold">Link</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => <DocumentTableRow key={document.id} document={document} basePath={basePath} />)}
              </tbody>
            </table>
          </>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value, detail, emphasis = false }: { label: string; value: number; detail: string; emphasis?: boolean }) {
  return <section className={`ui-card min-h-32 p-5 ${emphasis ? "border-[var(--warning)]" : ""}`}><p className="text-sm font-bold text-text-muted">{label}</p><p className="money-value mt-3 text-3xl font-bold tracking-[-0.04em] text-brand-navy">{value}</p><p className="mt-2 text-xs leading-5 text-[var(--text-subtle)]">{detail}</p></section>;
}

function DocumentTableRow({ document, basePath }: { document: DocumentRow; basePath: "/app" | "/demo" }) {
  return <tr className="border-t border-border-subtle transition-colors hover:bg-surface-secondary/60">
    <td className="min-w-64 px-5 py-4"><DocumentName document={document} basePath={basePath} /></td>
    <td className="px-5 py-4"><Validation document={document} /></td>
    <td className="px-5 py-4"><PipelineStatus status={document.extractionAttempts[0]?.status} unavailable={document.status !== "ACTIVE"} /></td>
    <td className="px-5 py-4"><PipelineStatus status={document.matchRuns[0]?.status} unavailable={document.status !== "ACTIVE"} /></td>
    <td className="px-5 py-4"><LinkStatus linked={document.transactions.length > 0} /></td>
  </tr>;
}

function DocumentCard({ document, basePath }: { document: DocumentRow; basePath: "/app" | "/demo" }) {
  return <article className="p-4 sm:p-5">
    <DocumentName document={document} basePath={basePath} />
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><StatusGroup label="Validation"><Validation document={document} /></StatusGroup><StatusGroup label="Extraction"><PipelineStatus status={document.extractionAttempts[0]?.status} unavailable={document.status !== "ACTIVE"} /></StatusGroup><StatusGroup label="Match"><PipelineStatus status={document.matchRuns[0]?.status} unavailable={document.status !== "ACTIVE"} /></StatusGroup><StatusGroup label="Link"><LinkStatus linked={document.transactions.length > 0} /></StatusGroup></div>
  </article>;
}

function DocumentName({ document, basePath }: { document: DocumentRow; basePath: "/app" | "/demo" }) {
  return <div><Link className="font-bold text-brand-navy underline decoration-brand-teal underline-offset-4" href={`${basePath}/documents/${document.id}`}>{document.displayName}</Link><p className="mt-1 text-xs leading-5 text-text-muted">{document.originalFilename} / {humanize(document.category)} / {formatSize(document.sizeBytes)}</p><p className="mt-1 text-xs text-[var(--text-subtle)]">{shortDate(document.documentDate)} / retained through {shortDate(document.retentionUntil)}</p></div>;
}

function StatusGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1 font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">{label}</p>{children}</div>;
}

function Validation({ document }: { document: DocumentRow }) {
  const presentation = documentValidationPresentation(document);
  return <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>;
}

function PipelineStatus({ status, unavailable }: { status?: string; unavailable: boolean }) {
  const presentation = documentPipelinePresentation(status, unavailable);
  return <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>;
}

function LinkStatus({ linked }: { linked: boolean }) {
  return <StatusBadge tone={linked ? "success" : "neutral"}>{linked ? "Linked" : "Not linked"}</StatusBadge>;
}

function documentAttention(document: DocumentRow) {
  const extraction = document.extractionAttempts[0];
  const match = document.matchRuns[0];
  if (document.status === "PENDING_VALIDATION") return ["Validation is pending; protected bytes remain unavailable."];
  if (document.status === "QUARANTINED") return ["This document is quarantined and cannot be opened."];
  if (extraction?.status === "FAILED" || extraction?.status === "STALE") return [`Extraction is ${extraction.status.toLowerCase()} and needs review.`];
  if (extraction?.candidates.some((candidate) => candidate.reviewState === "UNREVIEWED")) return ["Reviewed extraction fields are still needed."];
  if (match?.status === "STALE") return ["Suggested matches are stale and cannot be approved."];
  if (match?.suggestions.length) return ["A suggested transaction match needs an explicit decision."];
  if (document.status === "ACTIVE" && document.transactions.length === 0) return ["Active evidence has no linked transaction."];
  return [];
}
