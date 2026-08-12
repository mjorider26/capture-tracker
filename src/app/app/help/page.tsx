import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { OwnerRoutineGuide } from "@/components/owner-routine-guide";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  let context;
  try { context = await requireBusinessContext(); }
  catch (error) { if (isAccessControlError(error)) notFound(); throw error; }
  return <AppShell mode="app" destination={null} navigationDestination="help" businessName={context.business.displayName}><OwnerRoutineGuide basePath="/app" /></AppShell>;
}
