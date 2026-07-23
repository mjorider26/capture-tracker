import Link from "next/link";

import { BrandLockup } from "@/components/brand";
import { resolveLocalDemoContext } from "@/lib/security/local-demo-context";

export default async function Home() {
  const demo = await resolveLocalDemoContext();
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
          {demo ? (
            <Link
              href="/demo/today"
              className="mt-7 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--brand-navy-strong)]"
            >
              Open local demo
            </Link>
          ) : (
            <p className="mt-7 rounded-[var(--radius-md)] bg-surface-secondary p-4 text-sm leading-6 text-text-muted">
              The fictional local demo appears only when its explicit local
              safety gate is verified.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
