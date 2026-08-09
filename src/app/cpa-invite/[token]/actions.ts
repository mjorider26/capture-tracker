"use server";
import { redirect } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/auth/operator-authorization";
import { prisma } from "@/lib/prisma";
import { acceptCpaInvitation } from "@/lib/services/cpa-access";
export async function acceptCpaInvitationAction(form: FormData) { const token = String(form.get("token") ?? ""); try { const session = await requireAuthenticatedSession(); const result = await acceptCpaInvitation(prisma, { token, userId: session.userId, email: session.email }); if (!result.ok) redirect(`/cpa-invite/${encodeURIComponent(token)}?error=acceptance`); } catch { redirect(`/cpa-invite/${encodeURIComponent(token)}?error=acceptance`); } redirect("/app/reports"); }
