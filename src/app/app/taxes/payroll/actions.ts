"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";
import { recordPayrollRun } from "@/lib/services/payroll";

export type PayrollActionState = { status: "idle" | "success" | "error"; message: string | null };

export async function recordAuthenticatedPayroll(_previous: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  try {
    const context = await requireBusinessContext();
    const result = await recordPayrollRun(prisma, { businessId: context.business.id, actorUserId: context.user.id, role: context.membership.role, executionMode: "authenticated" }, Object.fromEntries(formData));
    if (!result.ok) return { status: "error", message: result.message };
    revalidatePath("/app/taxes"); revalidatePath("/app/taxes/payroll"); revalidatePath("/app/taxes/owner-compensation"); revalidatePath("/app/taxes/owner-money"); revalidatePath("/app/today"); revalidatePath("/app/review");
    return { status: "success", message: "Reviewed payroll was posted as a balanced payroll journal." };
  } catch { return { status: "error", message: "The payroll result could not be recorded safely. Refresh and try again." }; }
}
