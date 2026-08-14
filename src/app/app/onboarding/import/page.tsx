import { notFound } from "next/navigation";
import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding-shell";
import { TransactionImportExperience } from "@/components/transaction-import-experience";
import { getImportWorkspace } from "@/lib/services/financial-ingestion";
import { requireOnboardingContext } from "@/lib/security/business-context";
import { prisma } from "@/lib/prisma";

import { confirmOnboardingImport, ignoreOnboardingImportedTransaction, postOnboardingImportedTransaction, previewOnboardingImport } from "../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingImportPage() {
  const context = await requireOnboardingContext();
  const onboarding = await prisma.businessOnboarding.findUnique({ where: { businessId: context.business.id } });
  if (!onboarding || !["MANUAL_ACTIVITY", "INITIAL_ACTIVITY_REVIEW"].includes(onboarding.phase)) notFound();
  const workspace = await getImportWorkspace(context.business.id);
  return <OnboardingShell businessName={context.business.displayName} phase={onboarding.phase}><div className="mb-5"><Link className="ui-link font-bold" href="/app/onboarding">← Return to guided setup</Link></div><TransactionImportExperience {...workspace} previewAction={previewOnboardingImport} confirmAction={confirmOnboardingImport} postAction={postOnboardingImportedTransaction} ignoreAction={ignoreOnboardingImportedTransaction}/></OnboardingShell>;
}
