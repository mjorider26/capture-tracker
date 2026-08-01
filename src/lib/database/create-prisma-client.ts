import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

import { PrismaClient } from "../../generated/prisma/client";

export function normalizePrismaConnectionString(connectionString: string) {
  const normalized = connectionString.trim();
  if (!normalized) {
    throw new Error("A non-blank database connection string is required.");
  }
  const url = new URL(normalized);
  // Prisma Dev exposes the local fictional database on IPv4. Explicit loopback
  // avoids Node selecting an unavailable ::1 endpoint before that listener.
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.toString();
}

function runsInWorkerd() {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== "undefined";
}

// Framework-neutral construction is shared by CLI tools and server modules.
export function createPrismaClient(connectionString: string): PrismaClient {
  const normalizedConnectionString = normalizePrismaConnectionString(connectionString);
  const adapter = runsInWorkerd()
    ? (() => {
      // Cloudflare Workers request contexts cannot safely share WebSocket
      // connections. Prisma's Neon adapter issues one-shot queries, so use
      // Neon's HTTP transport and its server-side connection cache instead.
      neonConfig.poolQueryViaFetch = true;
      return new PrismaNeon({ connectionString: normalizedConnectionString });
    })()
    : new PrismaPg({ connectionString: normalizedConnectionString });

  return new PrismaClient({
    adapter,
  });
}
