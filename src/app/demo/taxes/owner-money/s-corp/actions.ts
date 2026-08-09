"use server";

import { revalidatePath } from "next/cache";

import type { SCorpActionState } from "@/components/s-corp-center";
import { prisma } from "@/lib/prisma";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { createBasisAdjustment, createDebtInstrument, saveAccountingPolicy, saveBasisOpening, saveHealthInsuranceWorkpaper } from "@/lib/services/s-corp-intelligence";

const actor = async () => { const context = await resolveLocalDemoContext(); return context ? { businessId: context.businessId, actorUserId: context.userId, actorMembershipId: context.membershipId, role: context.role, executionMode: "demo" as const } : null; };
const run = async (operation: (context: NonNullable<Awaited<ReturnType<typeof actor>>>, input: Record<string, FormDataEntryValue>) => Promise<{ ok: boolean; message?: string }>, formData: FormData): Promise<SCorpActionState> => { const context = await actor(); if (!context) return { status: "error", message: "Local demo entry is unavailable." }; const result = await operation(context, Object.fromEntries(formData)); if (!result.ok) return { status: "error", message: result.message ?? "The fictional workpaper could not be saved." }; revalidatePath("/demo/taxes/owner-money"); revalidatePath("/demo/taxes/owner-money/s-corp"); revalidatePath("/demo/taxes/year-end"); return { status: "success", message: "Fictional workpaper evidence saved." }; };
export async function saveDemoBasisOpeningAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveBasisOpening(prisma, context, input), formData); }
export async function saveDemoBasisAdjustmentAction(_: SCorpActionState, formData: FormData) { return run((context, input) => createBasisAdjustment(prisma, context, input), formData); }
export async function saveDemoDebtInstrumentAction(_: SCorpActionState, formData: FormData) { return run((context, input) => createDebtInstrument(prisma, context, input), formData); }
export async function saveDemoAccountingPolicyAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveAccountingPolicy(prisma, context, input), formData); }
export async function saveDemoHealthInsuranceAction(_: SCorpActionState, formData: FormData) { return run((context, input) => saveHealthInsuranceWorkpaper(prisma, context, input), formData); }
