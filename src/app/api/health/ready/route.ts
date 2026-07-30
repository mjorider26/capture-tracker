import { NextResponse } from "next/server";
import { healthContracts } from "@/lib/health-contract.mjs";
import { logServerEvent } from "@/lib/cloud/logging";
export const dynamic = "force-dynamic";
const readinessTimeoutMs = 5000;
async function bounded<T>(promise: Promise<T>) { return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), readinessTimeoutMs))]); }
async function queryReadiness() { const { prisma } = await import("@/lib/prisma"); return prisma.$queryRawUnsafe("SELECT 1"); }
export async function GET() { try { await bounded(queryReadiness()); return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); } catch { logServerEvent("readiness_unavailable"); return NextResponse.json({ status: healthContracts.readyFailClosed.status }, { status: healthContracts.readyFailClosed.httpStatus, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }); } }
