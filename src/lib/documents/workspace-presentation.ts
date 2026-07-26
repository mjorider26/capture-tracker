export type DocumentWorkspaceState = {
  status: string;
  malwareScanStatus: string;
  activeLinkCount: number;
};

export function documentWorkspaceMetrics(documents: DocumentWorkspaceState[]) {
  return {
    pending: documents.filter((document) => document.status === "PENDING_VALIDATION").length,
    active: documents.filter((document) => document.status === "ACTIVE").length,
    attention: documents.filter((document) => document.status === "PENDING_VALIDATION" || document.status === "QUARANTINED").length,
    linked: documents.filter((document) => document.activeLinkCount > 0).length,
  };
}

export function documentValidationPresentation(document: Pick<DocumentWorkspaceState, "status" | "malwareScanStatus">) {
  if (document.status === "ACTIVE" && document.malwareScanStatus === "CLEAN") {
    return { tone: "success" as const, label: "Active and clean" };
  }
  if (document.status === "PENDING_VALIDATION") {
    return { tone: "warning" as const, label: "Pending validation" };
  }
  return { tone: "locked" as const, label: humanize(document.status) };
}

export function documentPipelinePresentation(status: string | undefined, unavailable: boolean) {
  if (!status) {
    return unavailable
      ? { tone: "locked" as const, label: "Unavailable" }
      : { tone: "neutral" as const, label: "Not requested" };
  }
  return {
    tone: status === "COMPLETED" ? "success" as const : status === "FAILED" || status === "STALE" ? "locked" as const : "warning" as const,
    label: humanize(status),
  };
}

export function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
