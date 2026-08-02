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
      <section className="today-briefing" aria-hidden="true">
        <div className="today-cash-stage">
          <div className="ui-skeleton h-3 w-36" />
          <div className="ui-skeleton mt-14 h-20 w-72 max-w-full" />
          <div className="ui-skeleton mt-8 h-4 w-full max-w-xl" />
          <div className="mt-8 flex justify-between gap-4">
            <div className="ui-skeleton h-4 w-40" />
            <div className="ui-skeleton h-11 w-44" />
          </div>
        </div>
        <div className="today-planning-rail">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="ui-skeleton h-20 bg-white/10" />
          ))}
        </div>
        <div className="today-activity-ribbon">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 bg-surface-secondary" />
          ))}
        </div>
      </section>
      <div className="today-workspace">
        <div className="space-y-0">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-t border-border-subtle py-5">
              <div className="ui-skeleton h-4 w-56 max-w-full" />
              <div className="ui-skeleton mt-3 h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-8">
          <div className="ui-skeleton h-48" />
          <div className="ui-skeleton h-56" />
        </div>
      </div>
    </main>
  );
}
