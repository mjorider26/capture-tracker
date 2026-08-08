"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { documentScanRefreshIntervalMs, documentScanRefreshMaxAttempts, isDocumentScanTransientState } from "@/lib/documents/document-scan-refresh-core";

type ScanStatusResponse = { status: string; malwareScanStatus: string };

export function DocumentScanRefresh({ documentId, status, malwareScanStatus }: { documentId: string; status: string; malwareScanStatus: string }) {
  const router = useRouter();
  const isTransient = isDocumentScanTransientState({ status, malwareScanStatus });

  useEffect(() => {
    if (!isTransient) return;

    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let inFlight = false;
    let attempts = 0;

    const schedule = () => {
      if (!cancelled && attempts < documentScanRefreshMaxAttempts) {
        timer = window.setTimeout(poll, documentScanRefreshIntervalMs);
      }
    };

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      attempts += 1;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/scan-status`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 404) router.refresh();
          return;
        }
        const current = await response.json() as ScanStatusResponse;
        if (!isDocumentScanTransientState(current)) {
          router.refresh();
          return;
        }
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") schedule();
        return;
      } finally {
        inFlight = false;
      }
      schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controller?.abort();
    };
  }, [documentId, isTransient, router]);

  return null;
}
