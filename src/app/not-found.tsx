import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-stage grid min-h-screen place-items-center px-5 py-10 text-text-primary">
      <section className="auth-card ui-card w-full max-w-lg p-7 sm:p-10">
        <p className="auth-kicker">Capture Tracker</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.055em]">This view is unavailable.</h1>
        <p className="mt-4 text-sm leading-6 text-text-muted">
          The requested financial workspace view could not be found or is not available to this account.
        </p>
        <Link className="ui-button ui-button-primary mt-7 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-brand-navy px-5 text-sm font-bold text-white" href="/">
          Return to Capture Tracker
        </Link>
      </section>
    </main>
  );
}
