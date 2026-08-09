"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessMutationContext as requireBusinessContext } from "@/lib/security/business-context";
import { confirmMonthEndClose } from "@/lib/services/close";
export type CloseActionState = { status: "idle" | "success" | "error"; message: string | null };
export async function confirmAuthenticatedMonthClose(_previous: CloseActionState, formData: FormData): Promise<CloseActionState> { try { const context = await requireBusinessContext(); const result = await confirmMonthEndClose(prisma, { businessId: context.business.id, actorUserId: context.user.id, role: context.membership.role, executionMode: "authenticated" }, { month: String(formData.get("month") ?? ""), confirmation: String(formData.get("confirmation") ?? ""), notes: String(formData.get("notes") ?? "") }); if (!result.ok) return { status: "error", message: result.message }; revalidatePath("/app/taxes/close"); revalidatePath("/app/reports"); revalidatePath("/app/today"); revalidatePath("/app/review"); return { status: "success", message: "Month-end close recorded and the accounting period is locked." }; } catch { return { status: "error", message: "The month-end close could not be recorded safely." }; } }
