import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OwnerRoutineGuide } from "@/components/owner-routine-guide";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export default async function DemoHelpPage() {
  const context = await resolveLocalDemoContext();
  if (!context) notFound();
  return <AppShell mode="demo" destination={null} navigationDestination="help" businessName={context.businessName}><OwnerRoutineGuide basePath="/demo" /></AppShell>;
}
