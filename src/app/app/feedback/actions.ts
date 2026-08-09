"use server";

import { revalidatePath } from "next/cache";

import { appBuildId } from "@/lib/app-version";
import { prisma } from "@/lib/prisma";
import { requireBusinessContext } from "@/lib/security/business-context";

type State = { ok: boolean; message?: string };
const categories = new Set(["IMPORT", "ONBOARDING", "DOCUMENT", "ACCOUNTING", "OTHER"]);

export async function submitFeedbackAction(_: State, form: FormData): Promise<State> {
  try {
    const context = await requireBusinessContext();
    const category = String(form.get("category") ?? "");
    const description = String(form.get("description") ?? "").replace(/[<>]/g, "").trim().slice(0, 500);
    const route = String(form.get("route") ?? "").startsWith("/app/") ? String(form.get("route")).slice(0, 160) : "/app/feedback";
    if (!categories.has(category) || !description) return { ok: false, message: "Choose a category and add a short description." };
    await prisma.auditEvent.create({ data: { businessId: context.business.id, actorMembershipId: context.user.id, action: "CREATE", entityType: "CustomerFeedback", entityId: crypto.randomUUID(), afterJson: { category, description, route, build: appBuildId() }, metadataJson: { privacy: "No accounting values, document contents, or secrets are collected automatically." } } });
    revalidatePath("/app/feedback");
    return { ok: true, message: "Thank you. Your feedback was recorded for the Capture Tracker operator." };
  } catch { return { ok: false, message: "Feedback could not be recorded. Your accounting data has not changed." }; }
}
