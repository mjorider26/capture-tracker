import { NextResponse } from "next/server";

import { healthContracts } from "@/lib/health-contract.mjs";
import { logServerEvent } from "@/lib/cloud/logging";
import { createPrismaClient } from "@/lib/database/create-prisma-client";
import { runReadinessWithRetry } from "@/lib/health/readiness-retry";

export const dynamic = "force-dynamic";

const readinessTimeoutMs = 5000;

async function bounded<T>(promise: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(Object.assign(new Error("Readiness timeout"), { name: "TimeoutError" })),
          readinessTimeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function queryWithApplicationClient() {
  const { prisma } = await import("@/lib/prisma");
  await bounded(prisma.$queryRawUnsafe("SELECT 1"));
}

async function queryWithFreshClient() {
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
    await runReadinessWithRetry({
      firstAttempt: queryWithApplicationClient,
      retryAttempt: queryWithFreshClient,
    });

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
