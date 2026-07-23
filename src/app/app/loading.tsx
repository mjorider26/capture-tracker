export default function ApplicationLoading() {
  return (
    <main className="space-y-5" aria-label="Loading financial workspace">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-secondary" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="ui-card h-40 animate-pulse bg-surface-secondary"
          />
        ))}
      </div>
      <div className="ui-card h-72 animate-pulse bg-surface-secondary" />
    </main>
  );
}
