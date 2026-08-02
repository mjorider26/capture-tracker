import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActivityViewer } from "@/components/pilot-experience";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";
import { getActivity } from "@/lib/services/pilot-readiness";

export const dynamic = "force-dynamic";
export default async function DemoActivity({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await resolveLocalDemoContext(); if (!context) notFound();
  return <AppShell mode="demo" destination="activity" businessName={context.businessName}><ActivityViewer basePath="/demo" data={await getActivity(context.businessId, await searchParams)}/></AppShell>;
}
