import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InstallCaptureTracker } from "@/components/install-capture-tracker";
import { PilotSettings } from "@/components/pilot-experience";
import { appBuildId, appVersionLabel } from "@/lib/app-version";
import { isAccessControlError, requireBusinessContext } from "@/lib/security/business-context";
import { getPilotState } from "@/lib/services/pilot-readiness";
import { supportLinks } from "@/lib/support-links";

import { saveSettingsAction } from "./actions";

export default async function Settings() {
  const context = await getContext();
  const state = await getPilotState(context.business.id);
  const support = supportLinks();
  return <AppShell mode="app" destination="settings" businessName={context.business.displayName}>
    <PilotSettings state={state} action={saveSettingsAction}/>
    <section className="ui-card mt-5 max-w-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">Help and about</p>
      <h2 className="mt-1 text-lg font-bold">{appVersionLabel}</h2>
      <p className="mt-1 text-sm text-text-muted">Build {appBuildId()}</p>
      {state.business?.customerExperience === "FOUNDING_CUSTOMER" && <p className="mt-2 text-sm font-bold text-brand-teal">Founding Customer · Customer #001</p>}
      <p className="mt-3 text-sm text-text-muted">Install Capture Tracker on your iPhone or iPad for a focused home-screen experience.</p>
      <div className="mt-4"><InstallCaptureTracker /></div>
      <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2"><Link className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-3 pt-3 text-center font-bold" href="/app/onboarding">Quick Start</Link><Link className="ui-button ui-button-secondary min-h-11 rounded-[var(--radius-sm)] border border-border-subtle px-3 pt-3 text-center font-bold" href="/app/feedback">Report a problem</Link></div>
      <div className="mt-5 border-t border-border-subtle pt-4 text-sm text-text-muted"><p>Product Manual: available from your onboarding and release materials.</p><p className="mt-2">Privacy: {support.privacy ? <a className="font-bold underline" href={support.privacy}>View privacy information</a> : "link will be configured before the public site launches."}</p><p className="mt-2">Security: {support.security ? <a className="font-bold underline" href={support.security}>View security information</a> : "link will be configured before the public site launches."}</p><p className="mt-2">Support: {support.support ? <a className="font-bold underline" href={support.support}>{support.support}</a> : "contact will be configured before public launch."}</p></div>
    </section>
  </AppShell>;
}

async function getContext() { try { return await requireBusinessContext(); } catch (error) { if (isAccessControlError(error)) notFound(); throw error; } }
