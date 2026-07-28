import { NextResponse } from "next/server";
import { healthContracts } from "@/lib/health-contract.mjs";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json({ status: healthContracts.live.status }, { status: healthContracts.live.httpStatus, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); }
