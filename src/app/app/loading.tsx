export default function ApplicationLoading() {
  return (
    <main
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading financial workspace"
    >
      <div className="space-y-3">
        <div className="ui-skeleton h-3 w-28" />
        <div className="ui-skeleton h-10 w-64 max-w-full" />
        <div className="ui-skeleton h-4 w-full max-w-xl" />
      </div>
      <section
        className="ui-briefing min-h-[22rem] p-6 sm:p-8"
        aria-hidden="true"
      >
        <div className="ui-skeleton h-3 w-36 bg-white/10" />
        <div className="ui-skeleton mt-5 h-14 w-64 max-w-full bg-white/10" />
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-28 rounded-[var(--radius-md)] bg-white/[0.07]"
            />
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="ui-panel h-80 bg-surface-secondary" />
        <div className="ui-panel h-80 bg-surface-secondary" />
      </div>
    </main>
  );
}
