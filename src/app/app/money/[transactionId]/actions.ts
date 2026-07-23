"use server";

import { revalidatePath } from "next/cache";

import {
  reviewFromForm,
  type ReviewActionState,
} from "@/lib/services/review-transaction-action";
import { requireBusinessContext } from "@/lib/security/business-context";

export async function reviewAuthenticatedTransaction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await reviewFromForm(
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        actorMembershipId: context.membership.id,
        role: context.membership.role,
        executionMode: "authenticated",
      },
      formData,
    );
    if (result.status === "success") {
      revalidatePath("/app/money");
      revalidatePath("/app/today");
    }
    return result;
  } catch {
    return { status: "error", message: "Your review could not be authorized." };
  }
}
