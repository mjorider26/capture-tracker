"use server";

import { revalidatePath } from "next/cache";

import type { ManualTransactionActionState } from "@/components/manual-transaction-form";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { createManualTransaction } from "@/lib/services/manual-transaction";

export async function createDemoManualTransaction(
  _previous: ManualTransactionActionState,
  formData: FormData,
): Promise<ManualTransactionActionState> {
  const context = await resolveLocalDemoContext();
  if (!context) return { status: "error", message: "Local demo entry is unavailable." };
  const result = await createManualTransaction(prisma, { businessId: context.businessId, actorUserId: context.userId, actorMembershipId: context.membershipId, role: context.role, executionMode: "demo" }, Object.fromEntries(formData));
  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/demo/money"); revalidatePath("/demo/activity"); revalidatePath("/demo/today"); revalidatePath(`/demo/money/${result.transactionId}`);
  return { status: "success", message: result.code === "CREATED" ? "Transaction saved. Opening its detail…" : "This transaction was already saved. Opening its detail…", transactionId: result.transactionId };
}
