import Link from "next/link";
import { headers } from "next/headers";

import { BrandLockup } from "@/components/brand";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    <main className="grid min-h-screen place-items-center bg-page px-5 py-10 text-text-primary">
      <section className="ui-card w-full max-w-2xl p-7 sm:p-10">
        <BrandLockup priority className="mx-auto max-w-xl" />
        <div className="mt-8 border-t border-border-subtle pt-7">
          <p className="text-sm font-bold tracking-wide text-brand-teal">
            Financial command center
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            Focused books, calm decisions.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-text-muted sm:text-base">
            Capture Tracker keeps your reviewed business activity, tax planning,
            and weekly financial focus in one precise place.
          </p>
          <p className="mt-7 rounded-[var(--radius-md)] bg-surface-secondary p-4 text-sm leading-6 text-text-muted">
            This is a fictional staging environment. Do not enter real
            financial, customer, payroll, tax, or document data.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/sign-in"
              aria-label="Sign in to Capture Tracker"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-navy-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
            >
              Sign in
            </Link>
            <Link
              href="/create-account"
              aria-label="Create a fictional Capture Tracker practice account"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-border-strong bg-surface-primary px-5 text-sm font-bold text-text-primary transition hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal"
            >
              Create practice account
            </Link>
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
