import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import "./load-local-staging-environment";
import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { assertFictionalStagingBootstrap } from "../src/lib/cloud/staging-guards";
import {
  hashWorkerdPassword,
  verifyWorkerdPassword,
} from "../src/lib/auth/workerd-password";

const { config, email, password } = assertFictionalStagingBootstrap();

const fixture = {
  userId: "demo-user-jordan-ellis",
  businessId: "demo-business-northstar-field-solutions",
  ownerDisplayName: "Jordan Ellis",
};

async function deterministicFixtureExists(
  prisma: ReturnType<typeof createPrismaClient>,
) {
  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: fixture.businessId,
        userId: fixture.userId,
      },
    },
    select: { businessId: true },
  });

  return membership?.businessId === fixture.businessId;
}

const tsxCli = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const prisma = createPrismaClient(config.runtimeDatabaseUrl!);

try {
  // A verified deterministic fixture can coexist with other fictional staging
  // tenants. Re-seeding it would be both unnecessary and unsafe in that case.
  if (!(await deterministicFixtureExists(prisma))) {
    const seeded = spawnSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
      stdio: "pipe",
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: config.runtimeDatabaseUrl,
        CAPTURE_TRACKER_STAGING_BOOTSTRAP: "true",
      },
    });
    if (seeded.status !== 0) {
      const output = `${seeded.stdout ?? ""}\n${seeded.stderr ?? ""}`;
      const prismaCode = output.match(/\bP\d{4}\b/)?.[0] ?? "NONE";
      console.error(JSON.stringify({
        result: "FAIL",
        stage: "FICTIONAL_SEED",
        prismaCode,
        exitCode: seeded.status ?? "NO_EXIT_CODE",
      }));
      process.exitCode = 1;
    }
  }

  if (!process.exitCode) {
    // Better Auth resolves an email/password sign-in through User.email before
    // loading its credential account. Keep the deterministic fixture's user
    // identity and credential identifier aligned; changing only Account.accountId
    // leaves an otherwise valid password impossible to use.
    const existingEmailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmailOwner && existingEmailOwner.id !== fixture.userId) {
      throw new Error("The deterministic fictional staging login email belongs to another identity.");
    }
    await prisma.user.update({
      where: { id: fixture.userId },
      data: { email },
    });

    const credential = await prisma.account.findUnique({
      where: { id: "fictional-staging-credential" },
      select: { accountId: true, password: true, providerId: true, userId: true },
    });
    if (
      credential &&
      (credential.providerId !== "credential" || credential.userId !== fixture.userId)
    ) {
      throw new Error("The deterministic fictional staging credential is owned by an unexpected identity.");
    }
    const credentialReady = Boolean(
      credential &&
      credential.accountId === email &&
      credential.providerId === "credential" &&
      credential.userId === fixture.userId &&
      credential.password &&
      await verifyWorkerdPassword(credential.password, password),
    );
    if (!credentialReady) {
      const passwordHash = await hashWorkerdPassword(password);
      await prisma.account.upsert({
        where: { id: "fictional-staging-credential" },
        create: {
          id: "fictional-staging-credential",
          accountId: email,
          providerId: "credential",
          userId: fixture.userId,
          password: passwordHash,
        },
        update: {
          accountId: email,
          providerId: "credential",
          password: passwordHash,
        },
      });
    }

    // The credential is usable only when this fixed fictional workspace is
    // complete. This narrowly repairs the deterministic fixture and does not
    // touch unrelated identities, businesses, or business records.
    await prisma.businessOnboarding.upsert({
      where: { businessId: fixture.businessId },
      create: {
        businessId: fixture.businessId,
        actorUserId: fixture.userId,
        ownerDisplayName: fixture.ownerDisplayName,
        fictionalAcknowledged: true,
        chartConfirmed: true,
        status: "COMPLETED",
        completedAt: new Date(),
      },
      update: {
        actorUserId: fixture.userId,
        ownerDisplayName: fixture.ownerDisplayName,
        fictionalAcknowledged: true,
        chartConfirmed: true,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    console.log("Fictional staging bootstrap completed without exposing credential input.");
  }
} finally {
  await prisma.$disconnect();
}
