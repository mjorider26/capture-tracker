"use server";

import { revalidatePath } from "next/cache";

import type { TaxActionState } from "@/components/tax-payment-form";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { recordTaxPayment } from "@/lib/services/tax-payment";

export async function payDemo(
  _state: TaxActionState,
  form: FormData,
): Promise<TaxActionState> {
  try {
    const context = await resolveLocalDemoContext();
    if (!context) {
      return {
        code: "UNAUTHORIZED",
        message: "The local demo is unavailable.",
      };
    }
    const result = await recordTaxPayment(
      prisma,
      {
        businessId: context.businessId,
        actorUserId: context.userId,
        actorMembershipId: context.membershipId,
        role: context.role,
        executionMode: "demo",
      },
      {
        estimateId: form.get("estimateId"),
        expectedVersion: form.get("expectedVersion"),
        amount: form.get("amount"),
        paidAt: form.get("paidAt"),
        notes: form.get("notes"),
        idempotencyKey: form.get("idempotencyKey"),
      },
    );
    if (result.ok) {
      revalidatePath("/demo/taxes", "layout");
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
  } catch {
    return {
      code: "SAFE_FAILURE",
      message: "The payment could not be recorded safely.",
    };
  }
}
