"use server";

import { revalidatePath } from "next/cache";

import type { SCorpActionState } from "@/components/s-corp-center";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";
import { createBasisAdjustment, createDebtInstrument, saveAccountingPolicy, saveBasisOpening, saveHealthInsuranceWorkpaper } from "@/lib/services/s-corp-intelligence";

const refresh = () => { revalidatePath("/app/taxes/owner-money"); revalidatePath("/app/taxes/owner-money/s-corp"); revalidatePath("/app/taxes/year-end"); revalidatePath("/app/today"); };
const actor = async () => { const context = await requireBusinessContext(); return { businessId: context.business.id, actorUserId: context.user.id, actorMembershipId: context.membership.id, role: context.membership.role, executionMode: "authenticated" as const }; };
const run = async (operation: (context: Awaited<ReturnType<typeof actor>>, input: Record<string, FormDataEntryValue>) => Promise<{ ok: boolean; message?: string }>, formData: FormData): Promise<SCorpActionState> => { try { const result = await operation(await actor(), Object.fromEntries(formData)); if (!result.ok) return { status: "error", message: result.message ?? "The workpaper could not be saved safely." }; refresh(); return { status: "success", message: "Workpaper evidence saved." }; } catch { return { status: "error", message: "The workpaper could not be saved safely. Refresh and try again." }; } };
export async function saveBasisOpeningAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveBasisOpening(prisma, context, input), formData); }
export async function saveBasisAdjustmentAction(_: SCorpActionState, formData: FormData) { return run((context, input) => createBasisAdjustment(prisma, context, input), formData); }
export async function saveDebtInstrumentAction(_: SCorpActionState, formData: FormData) { return run((context, input) => createDebtInstrument(prisma, context, input), formData); }
export async function saveAccountingPolicyAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveAccountingPolicy(prisma, context, input), formData); }
export async function saveHealthInsuranceAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveHealthInsuranceWorkpaper(prisma, context, input), formData); }
