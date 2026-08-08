import { describe, expect, it } from "vitest";

import { documentScanRefreshIntervalMs, documentScanRefreshMaxAttempts, isDocumentScanTransientState } from "./document-scan-refresh-core";

describe("document scan refresh state", () => {
  it("refreshes only processing states at the bounded mobile-friendly cadence", () => {
    expect(documentScanRefreshIntervalMs).toBeGreaterThanOrEqual(2_000);
    expect(documentScanRefreshIntervalMs).toBeLessThanOrEqual(3_000);
    expect(documentScanRefreshMaxAttempts).toBeGreaterThan(0);
    expect(isDocumentScanTransientState({ status: "QUARANTINED", malwareScanStatus: "PENDING" })).toBe(true);
    expect(isDocumentScanTransientState({ status: "SCANNING", malwareScanStatus: "SCANNING" })).toBe(true);
  });

  it("stops refreshes for every terminal document outcome", () => {
    expect(isDocumentScanTransientState({ status: "ACTIVE", malwareScanStatus: "CLEAN" })).toBe(false);
    expect(isDocumentScanTransientState({ status: "QUARANTINED", malwareScanStatus: "FAILED" })).toBe(false);
    expect(isDocumentScanTransientState({ status: "REJECTED", malwareScanStatus: "INFECTED" })).toBe(false);
    expect(isDocumentScanTransientState({ status: "DELETED", malwareScanStatus: "CLEAN" })).toBe(false);
  });
});
