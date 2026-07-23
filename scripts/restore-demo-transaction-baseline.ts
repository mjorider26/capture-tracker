import "dotenv/config";

import { createPrismaClient } from "../src/lib/database/create-prisma-client";
import { restoreDemoMoneyBaseline } from "./demo-money-baseline";
import { requireSafeDemoDatabase } from "./demo-seed-safety";

const prisma = createPrismaClient(requireSafeDemoDatabase());

restoreDemoMoneyBaseline(prisma)
  .then(() => console.log("DEMO MONEY BASELINE RESTORED"))
  .catch(() => {
    console.error("Demo Money baseline restoration failed.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
