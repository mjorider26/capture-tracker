"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";
import { recordFixedAssetReview } from "@/lib/services/fixed-assets";
export type FixedAssetActionState = { status: "idle" | "success" | "error"; message: string | null };
export async function createAuthenticatedFixedAsset(_previous: FixedAssetActionState, formData: FormData): Promise<FixedAssetActionState> { try { const context = await requireBusinessContext(); const result = await recordFixedAssetReview(prisma, { businessId: context.business.id, actorUserId: context.user.id, role: context.membership.role, executionMode: "authenticated" }, Object.fromEntries(formData)); if (!result.ok) return { status: "error", message: result.message }; revalidatePath("/app/taxes/fixed-assets"); revalidatePath("/app/today"); revalidatePath("/app/review"); return { status: "success", message: "Possible fixed asset recorded for explicit capitalization review." }; } catch { return { status: "error", message: "The fixed-asset workpaper could not be saved safely." }; } }
