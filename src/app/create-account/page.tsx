import Link from "next/link";

import { CreateAccountForm } from "@/components/create-account-form";
import { readPublicBootstrapState } from "@/lib/auth/public-bootstrap-state";
import { productionBootstrapClosedMessage } from "@/lib/auth/production-owner-bootstrap-core";

export const dynamic = "force-dynamic";

export default async function CreateAccountPage() {
  const state = await readPublicBootstrapState();
  if (state.deploymentKind === "staging") {
    return <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary"><section className="auth-card ui-card w-full max-w-md p-7 sm:p-10">
      <p className="auth-kicker">Fictional staging workspace</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.055em]">Create practice account</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">Create a fictional practice account for this staging environment. Do not enter real financial, customer, payroll, tax, or document data.</p>
      <CreateAccountForm endpoint="/api/staging/create-practice-account" />
    </section></main>;
  }

  const available = state.bootstrapAvailability === "available";
  const unavailable = state.bootstrapAvailability === "unknown";
  return <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary"><section className="auth-card ui-card w-full max-w-md p-7 sm:p-10">
    <p className="auth-kicker">Private workspace setup</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.055em]">Create account</h1>
    {available ? <><p className="mt-3 text-sm leading-6 text-text-muted">Create the first owner account to finish setting up this private Capture Tracker workspace.</p><CreateAccountForm /></> : <div className="mt-7 grid gap-4"><p className="text-sm leading-6 text-text-muted">{unavailable ? "Account setup status is temporarily unavailable. Try again shortly." : productionBootstrapClosedMessage}</p><Link className="ui-button ui-button-primary min-h-11 text-center" href="/sign-in">Sign in</Link></div>}
  </section></main>;
}
