import { PrismaPg } from "@prisma/adapter-pg";

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

// Framework-neutral construction is shared by CLI tools and server modules.
export function createPrismaClient(connectionString: string): PrismaClient {
  const normalizedConnectionString = normalizePrismaConnectionString(connectionString);

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: normalizedConnectionString }),
  });
}
