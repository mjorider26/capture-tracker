import { NextResponse } from "next/server";

import { scannerRequestAuthorizationState } from "@/lib/documents/internal-scan-auth";
import { parseDocumentScanJob } from "@/lib/documents/scan-contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = scannerRequestAuthorizationState(request);
  if (!authorization.authorized) {
    console.warn(JSON.stringify({ event: "document_scan_internal_auth_denied", ...authorization, authorized: undefined }));
    return new NextResponse(null, { status: 404 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const job = parseDocumentScanJob(body);
  if (!job) return new NextResponse(null, { status: 400 });
  const { readQuarantinedDocumentForScan } = await import("@/lib/documents/scan-lifecycle");
  const document = await readQuarantinedDocumentForScan(job);
  // This caller is already authenticated. A 204 means that a duplicate or
  // stale delivery no longer has scan-eligible content; 404 remains reserved
  // for an unauthenticated caller and is retried fail-closed by the consumer.
  if (!document) return new NextResponse(null, { status: 204 });
  return new NextResponse(document.bytes, { headers: { "content-type": document.mimeType, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
