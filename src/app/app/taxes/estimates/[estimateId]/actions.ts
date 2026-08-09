"use server";

import { revalidatePath } from "next/cache";

import type { TaxActionState } from "@/components/tax-payment-form";
import { prisma } from "@/lib/prisma";
import {
  isAccessControlError,
  requireBusinessMutationContext as requireBusinessContext,
} from "@/lib/security/business-context";
import { recordTaxPayment } from "@/lib/services/tax-payment";

export async function payApp(
  _state: TaxActionState,
  form: FormData,
): Promise<TaxActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await recordTaxPayment(
      prisma,
      {
        businessId: context.business.id,
        actorUserId: context.user.id,
        actorMembershipId: context.membership.id,
        role: context.membership.role,
        executionMode: "authenticated",
      },
      {
        estimateId: form.get("estimateId"),
        expectedVersion: form.get("expectedVersion"),
        amount: form.get("amount"),
        paidAt: form.get("paidAt"),
        confirmationNumber: form.get("confirmationNumber"),
        notes: form.get("notes"),
        idempotencyKey: form.get("idempotencyKey"),
      },
    );
    if (result.ok) {
      revalidatePath("/app/taxes", "layout");
      revalidatePath("/app/today");
      return result.code === "CREATED"
        ? { code: "RECORDED", message: "Payment recorded externally." }
        : {
            code: "ALREADY_RECORDED",
            message:
              "The identical payment was already recorded. No second payment was created.",
          };
    }
    const code = {
      IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
      STALE_VERSION: "STALE_VERSION",
      FUTURE_VERSION: "FUTURE_VERSION",
      INVALID: "VALIDATION_ERROR",
      FORBIDDEN: "UNAUTHORIZED",
      NOT_FOUND: "SAFE_FAILURE",
      SAFE_FAILURE: "SAFE_FAILURE",
    } as const;
    return { code: code[result.code], message: result.message };
  } catch (error) {
    if (isAccessControlError(error)) {
      return {
        code: "UNAUTHORIZED",
        message: "You are not authorized to record a tax payment.",
      };
    }
    return {
      code: "SAFE_FAILURE",
      message: "The payment could not be recorded safely.",
    };
  }
}
