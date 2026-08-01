"use server";

import { revalidatePath } from "next/cache";

import type { ManualTransactionActionState } from "@/components/manual-transaction-form";
import { createManualTransaction } from "@/lib/services/manual-transaction";
import { requireBusinessContext } from "@/lib/security/business-context";
import { prisma } from "@/lib/prisma";

export async function createAuthenticatedManualTransaction(
  _previous: ManualTransactionActionState,
  formData: FormData,
): Promise<ManualTransactionActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await createManualTransaction(prisma, {
      businessId: context.business.id,
      actorUserId: context.user.id,
      actorMembershipId: context.membership.id,
      role: context.membership.role,
      executionMode: "authenticated",
    }, Object.fromEntries(formData));
    if (!result.ok) return { status: "error", message: result.message };
    revalidatePath("/app/money");
    revalidatePath("/app/activity");
    revalidatePath("/app/today");
    revalidatePath(`/app/money/${result.transactionId}`);
    return { status: "success", message: result.code === "CREATED" ? "Transaction saved. Opening its detail…" : "This transaction was already saved. Opening its detail…", transactionId: result.transactionId };
  } catch {
    return { status: "error", message: "The transaction could not be saved safely. Refresh and try again." };
  }
}
