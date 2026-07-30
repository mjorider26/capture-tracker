import { NextResponse } from "next/server";

import { healthContracts } from "@/lib/health-contract.mjs";
import { logServerEvent } from "@/lib/cloud/logging";
import { createPrismaClient } from "@/lib/database/create-prisma-client";

export const dynamic = "force-dynamic";

const readinessTimeoutMs = 5000;
const readinessRetryDelayMs = 150;

type ReadinessError = { code?: unknown; name?: unknown };

function isTransientReadinessFailure(error: unknown) {
  const candidate = error as ReadinessError | null;
  return ["P1001", "P1017", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(
    typeof candidate?.code === "string" ? candidate.code : "",
  ) || candidate?.name === "TimeoutError";
}

async function bounded<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("Readiness timeout"), { name: "TimeoutError" })), readinessTimeoutMs),
    ),
  ]);
}

async function queryReadiness() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Object.assign(new Error("Readiness configuration is unavailable"), { code: "CONFIGURATION" });

  const client = createPrismaClient(connectionString);
  try {
    await bounded(client.$queryRawUnsafe("SELECT 1"));
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

export async function GET() {
  try {
    try {
      await queryReadiness();
    } catch (error) {
      if (!isTransientReadinessFailure(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, readinessRetryDelayMs));
      await queryReadiness();
    }

    return NextResponse.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } },
    );
  } catch {
    logServerEvent("readiness_unavailable");
    return NextResponse.json(
      { status: healthContracts.readyFailClosed.status },
      {
        status: healthContracts.readyFailClosed.httpStatus,
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
      },
    );
  }
}
