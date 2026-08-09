import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";
import { appBuildId } from "@/lib/app-version";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";

import { submitFeedbackAction } from "./actions";

export default async function FeedbackPage() {
  const context = await getContext();
  return <AppShell mode="app" destination="settings" businessName={context.business.displayName}><section className="space-y-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Help and support</p><h1 className="mt-1 text-3xl font-bold text-brand-navy">Report a problem</h1><p className="mt-2 max-w-2xl text-sm text-text-muted">Tell us what needs attention without entering sensitive financial or document information.</p></div><CustomerFeedbackForm action={submitFeedbackAction} build={appBuildId()} /></section></AppShell>;
}

async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
