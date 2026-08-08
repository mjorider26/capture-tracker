import { NextResponse } from "next/server";

import { scannerRequestAuthorizationState } from "@/lib/documents/internal-scan-auth";
import { parseDocumentScanJob, parseDocumentScanResult } from "@/lib/documents/scan-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = scannerRequestAuthorizationState(request);
  if (!authorization.authorized) {
    console.warn(JSON.stringify({ event: "document_scan_internal_auth_denied", ...authorization, authorized: undefined }));
    return new NextResponse(null, { status: 404 });
  }
  let body: { job?: unknown; result?: unknown };
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const job = parseDocumentScanJob(body.job);
  const result = parseDocumentScanResult(body.result);
  if (!job || !result) return new NextResponse(null, { status: 400 });
  if (job.trace && result.category === "CLEAN") console.warn(JSON.stringify({ event: "document_scan_timing", stage: "CLEAN_RESULT_RECEIVED", correlationId: job.trace.correlationId, at: new Date().toISOString() }));
  const { applyDocumentScanResult } = await import("@/lib/documents/scan-lifecycle");
  const outcome = await applyDocumentScanResult(job, result);
  return NextResponse.json({ state: outcome.state }, { headers: { "cache-control": "no-store" } });
}
