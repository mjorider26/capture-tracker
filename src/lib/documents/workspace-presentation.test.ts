import { describe, expect, it } from "vitest";

import { documentPipelinePresentation, documentValidationPresentation, documentWorkspaceMetrics } from "./workspace-presentation";

describe("document workspace presentation", () => {
  it("keeps attention, active, and linked summaries derived from document lifecycle state", () => {
    expect(documentWorkspaceMetrics([
      { status: "PENDING_VALIDATION", malwareScanStatus: "NOT_STARTED", activeLinkCount: 0 },
      { status: "ACTIVE", malwareScanStatus: "CLEAN", activeLinkCount: 1 },
      { status: "QUARANTINED", malwareScanStatus: "QUARANTINED", activeLinkCount: 0 },
    ])).toEqual({ pending: 1, active: 1, attention: 2, linked: 1 });
  });

  it("presents an active private-pilot document without claiming a malware scan", () => {
    expect(documentValidationPresentation({ status: "ACTIVE", malwareScanStatus: "NOT_STARTED" })).toEqual({ tone: "success", label: "Active and private" });
    expect(documentValidationPresentation({ status: "ACTIVE", malwareScanStatus: "CLEAN" })).toEqual({ tone: "success", label: "Active and private" });
  });

  it("keeps unavailable and stale pipeline work explicit", () => {
    expect(documentPipelinePresentation(undefined, true)).toEqual({ tone: "locked", label: "Unavailable" });
    expect(documentPipelinePresentation("STALE", false)).toEqual({ tone: "locked", label: "Stale" });
  });
});
