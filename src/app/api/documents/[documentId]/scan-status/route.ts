import { NextResponse } from "next/server";

import { getDocumentScanStatus } from "@/lib/documents/service";
import { requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

const documentIdPattern = /^[A-Za-z0-9_-]{1,191}$/;

export async function GET(_: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const documentId = (await params).documentId;
  if (!documentIdPattern.test(documentId)) return new NextResponse(null, { status: 404 });
  try {
    const context = await requireBusinessContext();
    const scanState = await getDocumentScanStatus(context.business.id, documentId);
    if (!scanState) return new NextResponse(null, { status: 404 });
    return NextResponse.json(
      { status: scanState.status, malwareScanStatus: scanState.malwareScanStatus },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
