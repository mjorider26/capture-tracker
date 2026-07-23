"use server";

import { revalidatePath } from "next/cache";

import {
  reviewFromForm,
  type ReviewActionState,
} from "@/lib/services/review-transaction-action";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export async function reviewDemoTransaction(
  _previous: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const context = await resolveLocalDemoContext();
  if (!context)
    return { status: "error", message: "Local demo review is unavailable." };
  const result = await reviewFromForm(
    {
      businessId: context.businessId,
      actorUserId: context.userId,
      actorMembershipId: context.membershipId,
      role: context.role,
      executionMode: "demo",
    },
    formData,
  );
  if (result.status === "success") {
    revalidatePath("/demo/money");
    revalidatePath("/demo/today");
  }
  return result;
}
