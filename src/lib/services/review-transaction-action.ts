import "server-only";

import {
  reviewTransaction,
  type ReviewActorContext,
} from "./review-transaction";
import { prisma } from "../prisma";

export type ReviewActionState = {
  status: "idle" | "success" | "error" | "conflict" | "locked";
  message: string | null;
};

export const initialReviewActionState: ReviewActionState = {
  status: "idle",
  message: null,
};

export async function reviewFromForm(
  actor: ReviewActorContext,
  formData: FormData,
): Promise<ReviewActionState> {
  const splitCount = Number(formData.get("splitCount"));
  const splits =
    Number.isInteger(splitCount) && splitCount >= 0 && splitCount <= 12
      ? Array.from({ length: splitCount }, (_, index) => ({
          intent: formData.get(`split-intent-${index}`),
          amount: formData.get(`split-amount-${index}`),
          memo: formData.get(`split-memo-${index}`),
        }))
      : [];
  const result = await reviewTransaction(prisma, actor, {
    transactionId: formData.get("transactionId"),
    expectedVersion: formData.get("expectedVersion"),
    intent: formData.get("intent"),
    splits,
  });
  if (result.ok)
    return {
      status: "success",
      message: "Review saved. The transaction is now up to date.",
    };
  return {
    status:
      result.code === "CONFLICT"
        ? "conflict"
        : result.code === "LOCKED"
          ? "locked"
          : "error",
    message: result.message,
  };
}
