import "server-only";

import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "../prisma";

export type ManualTransactionEntryOptions = {
  cashAccounts: Array<{ id: string; name: string }>;
  incomeCategories: Array<{ id: string; name: string }>;
  expenseCategories: Array<{ id: string; name: string }>;
};

// businessId is resolved by a server-side authentication or demo context.
export async function getManualTransactionEntryOptions(businessId: string): Promise<ManualTransactionEntryOptions> {
  noStore();
  const [cashAccounts, categories] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { businessId, ownership: "BUSINESS", isActive: true, ledgerAccount: { is: { type: "ASSET", isActive: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.ledgerAccount.findMany({
      where: { businessId, isActive: true, financialAccountId: null, type: { in: ["INCOME", "EXPENSE"] } },
      orderBy: [{ code: "asc" }, { id: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);
  return {
    cashAccounts,
    incomeCategories: categories.filter((account) => account.type === "INCOME").map(({ id, name }) => ({ id, name })),
    expenseCategories: categories.filter((account) => account.type === "EXPENSE").map(({ id, name }) => ({ id, name })),
  };
}
