import { NextResponse } from "next/server";

import { importExampleTemplate } from "@/lib/imports/example-templates";
import { requireBusinessContext } from "@/lib/security/business-context";

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    await requireBusinessContext();
    const template = importExampleTemplate((await params).kind);
    if (!template) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(template.content, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${template.filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404, headers: { "cache-control": "private, no-store" } });
  }
}
