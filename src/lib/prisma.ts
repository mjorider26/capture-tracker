import "server-only";
import { PrismaClient } from "../generated/prisma/client";
import { createPrismaClient } from "./database/create-prisma-client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createApplicationPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return createPrismaClient(connectionString);
}

// The Next.js application uses this server-only development singleton.
export const prisma =
  globalForPrisma.prisma ?? createApplicationPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

