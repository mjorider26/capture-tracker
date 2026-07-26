import "server-only";

import { headers } from "next/headers";

import { prisma } from "../prisma";
import { localDevOrigins } from "./local-dev-origins";

const demoUserId = "demo-user-jordan-ellis";
const demoBusinessId = "demo-business-northstar-field-solutions";

function isLocalHost(host: string): boolean {
  const value = host.toLowerCase().replace(/\.$/, "");
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function parseRequestHost(value: string | null): boolean {
  if (!value) return false;
  try {
    const host = new URL(`http://${value}`).hostname;
    return (
      isLocalHost(host) ||
      (process.env.NODE_ENV === "development" && localDevOrigins().includes(host))
    );
  } catch {
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Demo context timed out.")),
          2_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type LocalDemoContext = {
  businessId: string;
  businessName: string;
  userId: string;
  membershipId: string;
  role: "OWNER";
};

// This checks the direct Host header available to Next.js, not X-Forwarded-Host. It protects local development,
// but a future reverse-proxy deployment must enforce equivalent host restrictions at the proxy boundary too.
export async function resolveLocalDemoContext(): Promise<LocalDemoContext | null> {
  try {
    if (
      process.env.CAPTURE_TRACKER_DATA_MODE !== "demo" ||
      process.env.DEMO_SEED_CONFIRMATION !== "CAPTURE_TRACKER_DEMO_ONLY" ||
      process.env.NODE_ENV === "production"
    )
      return null;

    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) return null;
    const parsedUrl = new URL(databaseUrl);
    const databaseName = decodeURIComponent(parsedUrl.pathname).replace(
      /^\//,
      "",
    );
    if (
      !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
      !isLocalHost(parsedUrl.hostname) ||
      !databaseName ||
      /(?:test|integration|shadow)/i.test(databaseName)
    )
      return null;

    const requestHeaders = await headers();
    if (!parseRequestHost(requestHeaders.get("host"))) return null;

    const [business, membership, credentialCount] = await withTimeout(
      Promise.all([
        prisma.business.findUnique({
          where: { id: demoBusinessId },
          select: { id: true, displayName: true },
        }),
        prisma.businessMember.findFirst({
          where: {
            businessId: demoBusinessId,
            userId: demoUserId,
            role: "OWNER",
          },
          select: { id: true, userId: true, role: true },
        }),
        prisma.account.count({ where: { userId: demoUserId } }),
      ]),
    );

    if (!business || !membership || credentialCount !== 0) return null;
    return {
      businessId: business.id,
      businessName: business.displayName,
      userId: membership.userId,
      membershipId: membership.id,
      role: "OWNER",
    };
  } catch {
    return null;
  }
}
