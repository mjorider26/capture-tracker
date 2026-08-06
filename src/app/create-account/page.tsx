import Link from "next/link";

import { CreateAccountForm } from "@/components/create-account-form";
import { isProductionOwnerBootstrapAvailable } from "@/lib/auth/production-owner-bootstrap";
import { productionBootstrapClosedMessage } from "@/lib/auth/production-owner-bootstrap-core";

export const dynamic = "force-dynamic";

export default async function CreateAccountPage() {
  const available = await isProductionOwnerBootstrapAvailable();
  return <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary"><section className="auth-card ui-card w-full max-w-md p-7 sm:p-10">
    <p className="auth-kicker">Private workspace setup</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.055em]">Create account</h1>
    {available ? <><p className="mt-3 text-sm leading-6 text-text-muted">Create the first owner account to finish setting up this private Capture Tracker workspace.</p><CreateAccountForm /></> : <div className="mt-7 grid gap-4"><p className="text-sm leading-6 text-text-muted">{productionBootstrapClosedMessage}</p><Link className="ui-button ui-button-primary min-h-11 text-center" href="/sign-in">Sign in</Link></div>}
  </section></main>;
}
