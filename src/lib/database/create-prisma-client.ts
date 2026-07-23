import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client";

// Framework-neutral construction is shared by CLI tools and server modules.
export function createPrismaClient(connectionString: string): PrismaClient {
  const normalizedConnectionString = connectionString.trim();

  if (!normalizedConnectionString) {
    throw new Error("A non-blank database connection string is required.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: normalizedConnectionString }),
  });
}
