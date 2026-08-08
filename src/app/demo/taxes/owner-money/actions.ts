"use server";
import { revalidatePath } from "next/cache";
import type { OwnerMoneyActionState } from "@/components/owner-money-experience";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { createPersonallyPaidReimbursement } from "@/lib/services/reimbursement";
export async function createDemoReimbursement(_previous: OwnerMoneyActionState, formData: FormData): Promise<OwnerMoneyActionState> { const context = await resolveLocalDemoContext(); if (!context) return { status: "error", message: "Local demo entry is unavailable." }; const result = await createPersonallyPaidReimbursement(prisma, { businessId: context.businessId, actorUserId: context.userId, actorMembershipId: context.membershipId, role: context.role, executionMode: "demo" }, Object.fromEntries(formData)); if (!result.ok) return { status: "error", message: result.message }; revalidatePath("/demo/taxes/owner-money"); revalidatePath("/demo/today"); revalidatePath("/demo/review"); return { status: "success", message: result.code === "CREATED" ? "Fictional reimbursement claim created for review." : "This reimbursement claim was already recorded." }; }
