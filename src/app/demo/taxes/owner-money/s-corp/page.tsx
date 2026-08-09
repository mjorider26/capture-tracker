import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SCorpCenter } from "@/components/s-corp-center";
import { TaxesNav } from "@/components/taxes-nav";
import { getSCorpCenter } from "@/lib/data/s-corp-center";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

import { saveDemoAccountingPolicyAction, saveDemoBasisAdjustmentAction, saveDemoBasisOpeningAction, saveDemoDebtInstrumentAction, saveDemoHealthInsuranceAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function DemoSCorpCenterPage() { const context = await resolveLocalDemoContext(); if (!context) notFound(); return <AppShell mode="demo" destination="taxes" businessName={context.businessName}><TaxesNav basePath="/demo" /><SCorpCenter data={await getSCorpCenter(context.businessId)} openingAction={saveDemoBasisOpeningAction} adjustmentAction={saveDemoBasisAdjustmentAction} debtAction={saveDemoDebtInstrumentAction} policyAction={saveDemoAccountingPolicyAction} healthAction={saveDemoHealthInsuranceAction} /></AppShell>; }
