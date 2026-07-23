import Link from "next/link";

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f8fc] p-6 text-[#10233f]">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dce5f0]">
        <p className="text-sm font-bold text-[#155eef]">Capture Tracker</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          A focused financial command center.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#63738a]">
          The local fictional demo is available only when its explicit safety
          gate is enabled.
        </p>
        <Link
          href="/demo/today"
          className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-[#155eef] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#104ac0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12b8c8]"
        >
          Open local demo
        </Link>
      </section>
    </main>
  );
}
