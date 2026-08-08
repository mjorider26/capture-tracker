export type DocumentScanPublicState = { status: string; malwareScanStatus: string };

export const documentScanRefreshIntervalMs = 2_500;
export const documentScanRefreshMaxAttempts = 120;

export function isDocumentScanTransientState(state: DocumentScanPublicState) {
  const transientDocument = ["PENDING_VALIDATION", "QUARANTINED", "SCANNING"].includes(state.status);
  const transientScan = ["PENDING", "NOT_STARTED", "SCANNING"].includes(state.malwareScanStatus);
  return transientDocument && transientScan;
}
