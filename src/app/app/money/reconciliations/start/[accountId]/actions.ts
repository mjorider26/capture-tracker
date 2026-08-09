"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { startReconciliation } from "@/lib/services/reconciliation";
import { requireBusinessContext } from "@/lib/security/business-context";

export async function startAuthenticatedReconciliation(form: FormData) {
  const context = await requireBusinessContext();
  const result = await startReconciliation(prisma, { businessId: context.business.id, actorUserId: context.user.id, actorMembershipId: context.membership.id, role: context.membership.role, executionMode: "authenticated" }, { accountId: form.get("accountId"), statementStartDate: form.get("statementStartDate"), statementEndDate: form.get("statementEndDate"), statementEndingBalance: form.get("statementEndingBalance") });
  if (!result.ok) redirect(`/app/money/reconciliations/start/${String(form.get("accountId") ?? "")}?error=start`);
  redirect(`/app/money/reconciliations/${result.reconciliationId}`);
}
