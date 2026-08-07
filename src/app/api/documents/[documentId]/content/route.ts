import { NextResponse } from "next/server";
import { getDocument } from "@/lib/documents/service";
import { getPrivateDocumentStorage } from "@/lib/documents/r2-storage";
import { verifyDocumentReadGrant } from "@/lib/documents/read-grant";
import { requireBusinessContext } from "@/lib/security/business-context";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const context = await requireBusinessContext();
    const documentId = (await params).documentId;
    const grant = new URL(request.url).searchParams.get("grant");
    const permitted = await verifyDocumentReadGrant(grant, { actorUserId: context.user.id, businessId: context.business.id, documentId });
    if (!permitted) return new NextResponse(null, { status: 404 });

    const document = await getDocument(context.business.id, documentId);
    if (!document || document.status !== "ACTIVE" || document.malwareScanStatus !== "CLEAN" || !document.privateReadEligible || document.storageState !== "STORED_PRIVATE" || !document.storageKey || document.deletedAt) return new NextResponse(null, { status: 404 });

    const object = await (await getPrivateDocumentStorage()).getActive(document.storageKey);
    if (!object) return new NextResponse(null, { status: 404 });
    return new NextResponse(object.body ?? await object.arrayBuffer(), { headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.originalFilename.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex",
    } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
