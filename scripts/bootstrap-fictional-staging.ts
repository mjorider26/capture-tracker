import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "./load-local-staging-environment";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { assertFictionalStagingBootstrap } from "../src/lib/cloud/staging-guards";
import { hashWorkerdPassword } from "../src/lib/auth/workerd-password";

const { config, email, password } = assertFictionalStagingBootstrap();

// The deterministic seed has its own target and foreign-data checks. This
// command is CLI-only, explicit, and never imported by an HTTP route.
const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
const seeded = spawnSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
  stdio: "pipe",
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: config.runtimeDatabaseUrl, CAPTURE_TRACKER_STAGING_BOOTSTRAP: "true" },
});
if (seeded.status !== 0) {
  const output = `${seeded.stdout ?? ""}\n${seeded.stderr ?? ""}`;
  const prismaCode = output.match(/\bP\d{4}\b/)?.[0] ?? "NONE";
  console.error(JSON.stringify({ result: "FAIL", stage: "FICTIONAL_SEED", prismaCode, exitCode: seeded.status ?? "NO_EXIT_CODE" }));
  process.exitCode = 1;
} else {
  const prisma = createPrismaClient(config.runtimeDatabaseUrl!);
  try {
    const passwordHash = await hashWorkerdPassword(password);
    await prisma.account.upsert({
      where: { id: "fictional-staging-credential" },
      create: { id: "fictional-staging-credential", accountId: email, providerId: "credential", userId: "demo-user-jordan-ellis", password: passwordHash },
      update: { accountId: email, providerId: "credential", password: passwordHash },
    });
    console.log("Fictional staging bootstrap completed without exposing credential input.");
  } finally {
    await prisma.$disconnect();
  }
}
