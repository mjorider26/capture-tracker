import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SCorpCenter } from "@/components/s-corp-center";
import { TaxesNav } from "@/components/taxes-nav";
import { getSCorpCenter } from "@/lib/data/s-corp-center";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

import { saveAccountingPolicyAction, saveBasisAdjustmentAction, saveBasisOpeningAction, saveDebtInstrumentAction, saveHealthInsuranceAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { robots: { index: false, follow: false } };
export default async function SCorpCenterPage() { let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } return <AppShell mode="app" destination="taxes" businessName={context.business.displayName}><TaxesNav basePath="/app" /><SCorpCenter data={await getSCorpCenter(context.business.id)} openingAction={saveBasisOpeningAction} adjustmentAction={saveBasisAdjustmentAction} debtAction={saveDebtInstrumentAction} policyAction={saveAccountingPolicyAction} healthAction={saveHealthInsuranceAction} /></AppShell>; }
