import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logServerEvent } from "@/lib/cloud/logging";
export const dynamic = "force-dynamic";
async function bounded<T>(promise: Promise<T>) { return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500))]); }
export async function GET() { try { await bounded(prisma.$queryRawUnsafe("SELECT 1")); return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); } catch { logServerEvent("readiness_unavailable"); return NextResponse.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); } }
