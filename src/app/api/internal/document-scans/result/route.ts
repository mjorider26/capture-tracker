import { NextResponse } from "next/server";

import { scannerRequestIsAuthorized } from "@/lib/documents/internal-scan-auth";
import { parseDocumentScanJob, parseDocumentScanResult } from "@/lib/documents/scan-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!scannerRequestIsAuthorized(request)) return new NextResponse(null, { status: 404 });
  let body: { job?: unknown; result?: unknown };
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const job = parseDocumentScanJob(body.job);
  const result = parseDocumentScanResult(body.result);
  if (!job || !result) return new NextResponse(null, { status: 400 });
  const { applyDocumentScanResult } = await import("@/lib/documents/scan-lifecycle");
  const outcome = await applyDocumentScanResult(job, result);
  return NextResponse.json({ state: outcome.state }, { headers: { "cache-control": "no-store" } });
}
