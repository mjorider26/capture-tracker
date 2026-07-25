import { spawnSync } from "node:child_process";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { assertFictionalStagingBootstrap } from "../src/lib/cloud/staging-guards";
import { hashPassword } from "better-auth/crypto";

const { config, email, password } = assertFictionalStagingBootstrap();

// The deterministic seed has its own target and foreign-data checks. This
// command is CLI-only, explicit, and never imported by an HTTP route.
const seeded = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "pipe",
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: config.runtimeDatabaseUrl, CAPTURE_TRACKER_STAGING_BOOTSTRAP: "true" },
});
if (seeded.status !== 0) throw new Error("Fictional staging bootstrap seed failed without exposing connection details.");

const prisma = createPrismaClient(config.runtimeDatabaseUrl!);
try {
  const passwordHash = await hashPassword(password);
  await prisma.account.upsert({
    where: { id: "fictional-staging-credential" },
    create: { id: "fictional-staging-credential", accountId: email, providerId: "credential", userId: "demo-user-jordan-ellis", password: passwordHash },
    update: { accountId: email, providerId: "credential", password: passwordHash },
  });
  console.log("Fictional staging bootstrap completed without exposing credential input.");
} finally {
  await prisma.$disconnect();
}
