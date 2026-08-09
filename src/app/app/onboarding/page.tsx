import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ClientCutoverSetup } from "@/components/client-cutover-setup";
import { getPilotState } from "@/lib/services/pilot-readiness";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

import { saveOnboardingAction } from "./actions";

export default async function Onboarding() { let context; try { context = await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } const state = await getPilotState(context.business.id); if (!state.business || !state.onboarding) notFound(); return <AppShell mode="app" destination={null} businessName={context.business.displayName}><ClientCutoverSetup action={saveOnboardingAction} defaults={{ displayName: state.business.displayName, legalName: state.business.legalName, timezone: state.business.timezone, fiscalYearStartMonth: state.business.fiscalYearStartMonth, ownerDisplayName: state.onboarding.ownerDisplayName }}/></AppShell>; }
