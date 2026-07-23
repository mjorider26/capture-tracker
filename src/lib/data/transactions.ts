import "server-only";

import { prisma } from "@/lib/prisma";

import { findTransactionForBusiness } from "./transaction-access-core";

export async function getTransactionForBusiness({
  businessId,
  transactionId,
}: {
  businessId: string;
  transactionId: string;
}) {
  return findTransactionForBusiness(prisma, {
    businessId,
    transactionId,
  });
}
