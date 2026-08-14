import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentUploadForm } from "@/components/document-upload-form";
import { OnboardingShell, SetupCard } from "@/components/onboarding-shell";
import { prisma } from "@/lib/prisma";
import { requireOnboardingContext } from "@/lib/security/business-context";

import { uploadOnboardingStatement } from "../actions";

export const dynamic = "force-dynamic";

export default async function OnboardingStatementPage() {
  const context = await requireOnboardingContext();
  const onboarding = await prisma.businessOnboarding.findUnique({ where: { businessId: context.business.id } });
  if (!onboarding || onboarding.phase !== "MANUAL_ACTIVITY") notFound();
  return <OnboardingShell businessName={context.business.displayName} phase={onboarding.phase}><SetupCard eyebrow="Statement evidence" title="Upload a bank or card statement" description="A statement is private reconciliation evidence. Uploading a PDF or image never creates transactions, categories, or journal entries."><DocumentUploadForm uploadAction={uploadOnboardingStatement} title="Store statement evidence privately" description="Select a PDF, PNG, or JPEG. Capture Tracker validates the file, quarantines it, and security-scans it before it can be used as evidence." cameraLabel="Take photo of statement"/><Link href="/app/onboarding" className="ui-button ui-button-primary mt-5 inline-flex min-h-12 items-center px-5 font-bold">Return to bank activity setup</Link></SetupCard></OnboardingShell>;
}
