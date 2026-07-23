import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  const [businesses, transactions, journalEntries] =
    await Promise.all([
      prisma.business.count(),
      prisma.transaction.count(),
      prisma.journalEntry.count(),
    ]);

  console.log("DATABASE CONNECTION VERIFIED");
  console.log(`Businesses: ${businesses}`);
  console.log(`Transactions: ${transactions}`);
  console.log(`Journal entries: ${journalEntries}`);
}

main()
  .catch((error: unknown) => {
    console.error("DATABASE CONNECTION FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

