import { NextResponse } from "next/server";

import { scannerRequestAuthorizationState } from "@/lib/documents/internal-scan-auth";
import { parseDocumentScanJob } from "@/lib/documents/scan-contract";

export const dynamic = "force-dynamic";

/**
 * Persists a bounded, sanitized post-ack scan trace. It is deliberately
 * separate from result application: a telemetry failure can never cause a
 * Queue retry, state change, or unsafe activation.
 */
export async function POST(request: Request) {
  const authorization = scannerRequestAuthorizationState(request);
  if (!authorization.authorized) return new NextResponse(null, { status: 404 });
  let body: { job?: unknown };
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const job = parseDocumentScanJob(body.job);
  if (!job?.trace) return new NextResponse(null, { status: 400 });
  const { persistDocumentScanTrace } = await import("@/lib/documents/scan-lifecycle");
  await persistDocumentScanTrace(job);
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
