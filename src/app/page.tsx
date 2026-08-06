import Link from "next/link";
import { headers } from "next/headers";

import { BrandLockup } from "@/components/brand";
import { auth } from "@/lib/auth";
import { landingOnboardingPresentation } from "@/lib/auth/onboarding-presentation";
import { readPublicBootstrapState } from "@/lib/auth/public-bootstrap-state";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const state = await readPublicBootstrapState();
  const onboarding = landingOnboardingPresentation(undefined, state.bootstrapAvailability === "available");
  return (
    <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary">
      <section className="auth-card ui-card w-full max-w-2xl p-7 sm:p-10">
        <BrandLockup priority className="mx-auto max-w-xl" />
        <div className="mt-8 border-t border-border-subtle pt-7">
          <p className="auth-kicker">
            Financial command center
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.055em] sm:text-5xl">
            Your business financial workspace
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-text-muted sm:text-base">
            Capture Tracker keeps your reviewed business activity, tax planning,
            and weekly financial focus in one precise place.
          </p>
          <p className="auth-note mt-7 rounded-[var(--radius-md)] p-4 text-sm leading-6 text-text-muted">
            {onboarding.notice}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sign-in"
              aria-label="Sign in to Capture Tracker"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-navy-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
            >
              Sign in
            </Link>
            {onboarding.accountCreationAvailable ? (
              <Link
                href="/create-account"
                aria-label={onboarding.accountCreationAriaLabel}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-5 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
              >
                {onboarding.accountCreationLabel}
              </Link>
            ) : null}
            {session ? (
              <Link
                href="/app"
                aria-label="Open the Capture Tracker application"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-5 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
              >
                Open application
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
