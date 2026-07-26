import { NextResponse } from "next/server";
import { requireBusinessContext } from "@/lib/security/business-context";
import { buildExport } from "@/lib/services/pilot-readiness";
export async function GET(_: Request,{params}:{params:Promise<{kind:string}>}){try{const c=await requireBusinessContext();const data=await buildExport({businessId:c.business.id,actorUserId:c.user.id},(await params).kind);if(!data)return new NextResponse("Export unavailable.",{status:404});return new NextResponse(data.csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${data.filename}"`,"Cache-Control":"private, no-store"}})}catch{return new NextResponse("Export unavailable.",{status:403})}}
