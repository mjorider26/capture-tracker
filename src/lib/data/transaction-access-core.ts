import type { PrismaClient } from "../../generated/prisma/client";

type TransactionClient = Pick<PrismaClient, "transaction">;

export async function findTransactionForBusiness(
  client: TransactionClient,
  {
    businessId,
    transactionId,
  }: {
    businessId: string;
    transactionId: string;
  },
) {
  return client.transaction.findFirst({
    where: {
      id: transactionId,
      businessId,
    },

    select: {
      id: true,
      businessId: true,
      accountId: true,
      description: true,
      amount: true,
      direction: true,
      postedAt: true,
    },
  });
}
