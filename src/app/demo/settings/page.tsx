import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PilotSettings } from "@/components/pilot-experience";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { getPilotState } from "@/lib/services/pilot-readiness";
import { saveDemoSettings } from "./actions";

export const dynamic = "force-dynamic";
export default async function DemoSettings() {
  const context = await resolveLocalDemoContext(); if (!context) notFound();
  return <AppShell mode="demo" destination="settings" businessName={context.businessName}><PilotSettings basePath="/demo" state={await getPilotState(context.businessId)} action={saveDemoSettings}/></AppShell>;
}
