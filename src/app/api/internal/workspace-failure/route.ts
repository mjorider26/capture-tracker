import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const categories = new Set(["CLIENT_ASSET", "RSC_RESPONSE", "NETWORK", "DOCUMENT_SCAN_SCHEMA", "CLIENT_RENDER"]);

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new NextResponse(null, { status: 404 });
    const body = await request.json() as { category?: unknown; pathname?: unknown; digest?: unknown };
    if (typeof body.category !== "string" || !categories.has(body.category)) return new NextResponse(null, { status: 400 });
    const pathname = typeof body.pathname === "string" && /^\/app(?:\/[a-z-]+)?$/.test(body.pathname) ? body.pathname : "/app";
    const digest = typeof body.digest === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(body.digest) ? body.digest : undefined;
    console.error(JSON.stringify({ event: "workspace_client_render_failed", category: body.category, pathname, ...(digest ? { digest } : {}) }));
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
